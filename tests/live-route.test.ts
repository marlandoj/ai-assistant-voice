import { test, expect, beforeAll, afterAll } from "bun:test";
import { createHmac } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch=mkdtempSync(join(tmpdir(),"zo-task-live-tests-"));
const secret="fixture-only-not-a-real-secret";
process.env.ZO_ASK_TOKEN=secret;
process.env.OPENAI_API_KEY="fixture";
process.env.MCP_SHARED_TOKEN="fixture";
process.env.VOICE_LIVE_DB_PATH=join(scratch,"state.sqlite");
let handler:any;
const originalFetch=globalThis.fetch;
let mode="read", writes=0, models=0, sessions=0, gate=false;
let unblock: (()=>void)|undefined;
function token(){const payload=`v1.${Date.now()+60000}.fixture`;return `${payload}.${createHmac("sha256",secret).update(payload).digest("hex")}`;}
async function call(body:any,options:{auth?:boolean;cookie?:string;origin?:string}={}){
  const headers=new Headers({"Content-Type":"application/json",Origin:options.origin||"https://zite-3099-test.zo.computer"});
  if(options.auth!==false)headers.set("X-Test-Auth",token());
  if(options.cookie!=="")headers.set("Cookie",options.cookie||"zo_session=valid");
  const req=new Request("https://test.zo.space/api/test-live",{method:"POST",headers,body:JSON.stringify(body)});
  const response=await handler({req:{method:"POST",header:(key:string)=>req.headers.get(key)||undefined,text:()=>req.text()}});
  return {status:response.status,data:await response.json()};
}
async function create(cookie?:string){return (await call({action:"create",request_id:crypto.randomUUID(),sdp:"v=0\r\nfixture",persona_id:"persona"},{cookie})).data.session_id;}
const fragment=(text:string)=>[{role:"user",delta:text,start_ms:0,end_ms:1000}];
beforeAll(async()=>{
  const source=(await Bun.file(new URL("../assets/live-route.ts",import.meta.url)).text()).replaceAll("{{ZO_HOST}}","https://test.zo.space").replaceAll("{{ASSISTANT_NAME}}","Test").replaceAll("{{ASSISTANT_SLUG}}","test").replaceAll("{{MCP_TOKEN_ENV}}","MCP_SHARED_TOKEN").replaceAll("{{DEFAULT_PERSONA_ID}}","persona").replaceAll("{{PAGE_PATH}}","/voice");
  await Bun.write(join(scratch,"route.ts"),source);
  handler=(await import(join(scratch,"route.ts"))).default;
  globalThis.fetch=(async(input:any,init:any)=>{
    const url=String(input);
    if(init?.method==="HEAD")return new Response(null,{status:init.headers.Cookie.includes("valid")&&!init.headers.Cookie.includes("invalid")?200:302});
    if(url.endsWith("/mcp")||url.endsWith("-mcp")){
      const body=JSON.parse(init.body);
      if(body.method==="tools/list")return Response.json({result:{tools:["memory_search","send_sms","calendar_create_event","bash"].map(name=>({name,description:name,inputSchema:{type:"object",properties:{}}}))}});
      if(body.params.name==="list_personas")return Response.json({result:{content:[{text:JSON.stringify([{id:"persona",name:"Test Persona",prompt:"Be concise."}])}]}});
      if(body.params.name==="send_sms"){writes++;if(mode==="uncertain")throw new Error("lost receipt");}
      if(mode==="timeout_receipt")return Response.json({result:{isError:false,content:[{type:"text",text:"That's taking longer than real-time allows. I'll send the result via SMS once it completes — ask me to follow up."}]}});
      if(mode==="empty_receipt")return Response.json({result:{isError:false,content:[]}});
      return Response.json({result:{content:[{type:"text",text:body.params.name==="send_sms"?"SMS sent.":"Verified memory fact."}]}});
    }
    if(url.endsWith("/live/sessions")){sessions++;return Response.json({session:{id:`live_${sessions}`},transport:{type:"webrtc",sdp:"v=0\r\nanswer"}});}
    if(url.endsWith("/hangup"))return new Response(null,{status:200});
    if(url.endsWith("/responses")){
      models++;const body=JSON.parse(init.body);
      expect(body.store).toBe(false);expect(body.tools.some((tool:any)=>tool.name==="bash")).toBe(false);
      if(gate)await new Promise<void>(resolve=>{unblock=resolve;});
      const done=body.input.some((item:any)=>item.type==="function_call_output");
      const output=mode==="plain"||done?[{type:"message",content:[{type:"output_text",text:"Verified answer."}]}]:[{type:"function_call",call_id:"call_1",name:mode==="forbidden"?"bash":mode==="read"?"memory_search":"send_sms",arguments:JSON.stringify(mode==="read"?{query:"preference"}:{message:"Test only"})}];
      return Response.json({status:"completed",output});
    }
    throw new Error(`Unexpected fixture URL ${url}`);
  }) as typeof fetch;
});
afterAll(()=>{globalThis.fetch=originalFetch;rmSync(scratch,{recursive:true,force:true});});

test("rejects public bootstrap token without owner cookie",async()=>{expect((await call({action:"create"},{cookie:""})).status).toBe(401);});
test("rejects invalid cookie, forged token and another origin",async()=>{
  expect((await call({action:"create"},{cookie:"zo_session=invalid"})).status).toBe(401);
  expect((await call({action:"create"},{auth:false})).status).toBe(401);
  expect((await call({action:"create"},{origin:"https://attacker.zo.space"})).status).toBe(403);
});
test("create validates SDP and deduplicates initialization",async()=>{
  const cookie="zo_session=valid-create";
  expect((await call({action:"create",request_id:"request123",sdp:"bad"},{cookie})).status).toBe(400);
  const body={action:"create",request_id:"request123",sdp:"v=0\r\n",persona_id:"persona"};
  const first=await call(body,{cookie});expect(first.status).toBe(201);
  expect(first.data.transport.sdp).toContain("v=0");
  expect((await call(body,{cookie})).status).toBe(409);
});
test("read delegation uses tools and duplicate delegation does not repeat",async()=>{
  mode="read";const session_id=await create("zo_session=valid-read"),cookie="zo_session=valid-read";
  const request={action:"delegate",session_id,delegation_id:"item_read",offset_ms:1000,fragments:fragment("Recall my preference")};
  const response=await call(request,{cookie});expect(response.data.status).toBe("completed");expect(response.data.result).toBe("Verified answer.");
  const before=models;expect((await call(request,{cookie})).data.status).toBe("completed");expect(models).toBe(before);
});
test("write approval requires exact id and executes once under concurrent requests",async()=>{
  mode="write";const cookie="zo_session=valid-write",session_id=await create(cookie);
  const task=(await call({action:"delegate",session_id,delegation_id:"item_write",offset_ms:1000,fragments:fragment("Text me Test only")},{cookie})).data;
  expect(task.status).toBe("approval");const before=writes;
  const request={action:"approve",session_id,task_id:task.task_id,approval_id:task.approval.id,approve:true};
  expect((await call({...request,approval_id:"forged"},{cookie})).status).toBe(409);expect(writes).toBe(before);
  const results=await Promise.all([call(request,{cookie}),call(request,{cookie})]);
  expect(results.map(r=>r.status).sort()).toEqual([200,409]);expect(writes).toBe(before+1);
});
test("correction invalidates approval and rejection never writes",async()=>{
  mode="write";const cookie="zo_session=valid-correction",session_id=await create(cookie);
  const task=(await call({action:"delegate",session_id,delegation_id:"item_correct",offset_ms:1000,fragments:fragment("Send Friday")},{cookie})).data;
  const before=writes;
  await call({action:"context",session_id,fragments:fragment("Thursday instead")},{cookie});
  expect((await call({action:"approve",session_id,task_id:task.task_id,approval_id:task.approval.id,approve:true},{cookie})).status).toBe(409);
  expect(writes).toBe(before);
  const next=(await call({action:"delegate",session_id,delegation_id:"item_reject",offset_ms:1000,fragments:fragment("Thursday instead")},{cookie})).data;
  expect((await call({action:"approve",session_id,task_id:next.task_id,approval_id:next.approval.id,approve:false},{cookie})).data.status).toBe("rejected");expect(writes).toBe(before);
});
test("unavailable tools fail closed",async()=>{
  mode="forbidden";const cookie="zo_session=valid-forbidden",session_id=await create(cookie);
  const task=(await call({action:"delegate",session_id,delegation_id:"item_forbidden",offset_ms:1000,fragments:fragment("Execute shell")},{cookie})).data;
  expect(task.status).toBe("failed");expect(task.result).toBe("tool_not_allowed");
});
test("lost write receipt stays uncertain and cannot replay",async()=>{
  mode="uncertain";const cookie="zo_session=valid-uncertain",session_id=await create(cookie);
  const task=(await call({action:"delegate",session_id,delegation_id:"item_uncertain",offset_ms:1000,fragments:fragment("Text me")},{cookie})).data;
  const req={action:"approve",session_id,task_id:task.task_id,approval_id:task.approval.id,approve:true};
  expect((await call(req,{cookie})).data.status).toBe("uncertain");const before=writes;
  expect((await call(req,{cookie})).status).toBe(409);expect(writes).toBe(before);
});
for (const outcome of ["timeout_receipt", "empty_receipt"]) {
  test(`${outcome} cannot claim completion or replay an action`, async()=>{
    mode=outcome;const cookie=`zo_session=valid-${outcome}`,session_id=await create(cookie);
    const task=(await call({action:"delegate",session_id,delegation_id:outcome,offset_ms:1000,fragments:fragment("Text me")},{cookie})).data;
    const request={action:"approve",session_id,task_id:task.task_id,approval_id:task.approval.id,approve:true};
    const before=writes,result=await call(request,{cookie});
    expect(result.data.status).toBe("uncertain");expect(result.data.result).toContain("unconfirmed");expect(result.data.result).not.toContain("I'll send");
    expect(writes).toBe(before+1);expect((await call(request,{cookie})).status).toBe(409);expect(writes).toBe(before+1);
  });
}
test("cancellation wins over late model completion",async()=>{
  mode="plain";gate=true;const cookie="zo_session=valid-cancel",session_id=await create(cookie);
  const pending=call({action:"delegate",session_id,delegation_id:"item_cancel",offset_ms:1000,fragments:fragment("Question")},{cookie});
  for(let i=0;i<50&&!unblock;i++)await Bun.sleep(5);
  const status=await call({action:"status",session_id},{cookie});const task=status.data.tasks[0];
  expect((await call({action:"cancel",session_id,task_id:task.task_id},{cookie})).data.cancelled).toBe(true);
  gate=false;unblock?.();unblock=undefined;expect((await pending).data.status).toBe("cancelled");
});
test("close cancels approvals and resume preserves history without replay",async()=>{
  mode="write";const cookie="zo_session=valid-resume",session_id=await create(cookie);
  await call({action:"delegate",session_id,delegation_id:"item_resume",offset_ms:1000,fragments:fragment("Text me")},{cookie});
  const before=writes;expect((await call({action:"close",session_id},{cookie})).data.status).toBe("closed");
  const resumed=await call({action:"create",resume_session_id:session_id,request_id:crypto.randomUUID(),sdp:"v=0\r\n",persona_id:"persona"},{cookie});
  expect(resumed.status).toBe(201);expect(resumed.data.fragments.length).toBe(1);expect(resumed.data.previous_tasks[0].status).toBe("cancelled");expect(writes).toBe(before);
  expect((await call({action:"status",session_id},{cookie:"zo_session=valid-other"})).status).toBe(404);
});
