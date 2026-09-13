import { afterAll, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import handler, { readMemoryRecords, callRagTool, handleWorkspaceSearch, withToolDeadline } from "../assets/alaric-mcp-route.ts";

const scratch = mkdtempSync(join(tmpdir(), "zo-task-voice-retrieval-"));
const path = join(scratch, "memory | with spaces.sqlite");
const db = new Database(path);
db.run("CREATE TABLE facts (id TEXT, entity TEXT, key TEXT, value TEXT, persona TEXT, source TEXT, created_at INTEGER, expires_at INTEGER, gate_status TEXT)");
db.run("CREATE VIRTUAL TABLE facts_fts USING fts5(value, content='facts', content_rowid='rowid')");
db.run("CREATE TABLE open_loops (id TEXT, title TEXT, summary TEXT, kind TEXT, status TEXT, priority REAL, source TEXT, updated_at INTEGER)");
const insert = db.query("INSERT INTO facts VALUES (?,?,?,?,?,?,?,?,?)");
insert.run("valid", "user", "drink", "Café | O'Brien\npréférence", "shared", "fixture.md", 1, null, "allow");
insert.run("expired", "user", "drink", "Café expired", "shared", "old.md", 1, 1, "allow");
insert.run("withheld", "user", "drink", "Café withheld", "shared", "no.md", 1, null, "deny");
insert.run("private", "user", "drink", "Café scoped", "other", "scope.md", 1, null, "allow");
db.run("INSERT INTO facts_fts(facts_fts) VALUES ('rebuild')");
db.query("INSERT INTO open_loops VALUES (?,?,?,?,?,?,?,?)").run("loop", "Fix | multiline\nwork", "It has quotes ' and |", "bug", "open", 0.9, "fixture.md", 2);
db.close();
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

test("memory handles Unicode, quotes, pipes and paths without shell parsing", () => {
  const result = readMemoryRecords("facts", { query: "Café", scope: "shared" }, path);
  expect(result.count).toBe(1);
  expect(result.records[0]).toMatchObject({ id: "valid", value: "Café | O'Brien\npréférence", source: "fixture.md" });
});
test("memory broadens keyword matches and enforces scope and expiry", () => {
  const result = readMemoryRecords("facts", { query: "remember Café unknown", scope: "shared" }, path);
  expect(result).toMatchObject({ mode: "any_keyword_fallback", count: 1 });
  expect(readMemoryRecords("facts", { query: "Café", scope: "other" }, path).records[0]).toMatchObject({ id: "private" });
  expect(readMemoryRecords("facts", { query: "unmatched" }, path).count).toBe(0);
  expect(() => readMemoryRecords("facts", { query: "---" }, path)).toThrow();
  expect(() => readMemoryRecords("facts", { query: "Café", scope: "' OR 1=1" }, path)).toThrow();
});
test("open loops preserve columns and reject invalid status", () => {
  expect(readMemoryRecords("loops", { limit: 5 }, path).records[0]).toMatchObject({ title: "Fix | multiline\nwork", kind: "bug", priority: 0.9 });
  expect(readMemoryRecords("loops", { status: "resolved" }, path).count).toBe(0);
  expect(() => readMemoryRecords("loops", { status: "bad" }, path)).toThrow();
});
test("timeout is an unconfirmed error, with no automatic replay", async () => {
  let calls = 0;
  const result = await withToolDeadline(() => { calls++; return new Promise(() => {}); }, 5);
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain("Outcome unconfirmed");
  expect(result.content[0].text).toContain("No follow-up message has been scheduled");
  expect(calls).toBe(1);
});

function fixture(name: string, response: string) {
  const path = join(scratch, name + ".ts");
  writeFileSync(path, `let buffer=""; for await (const bytes of Bun.stdin.stream()) { buffer+=new TextDecoder().decode(bytes); let index; while((index=buffer.indexOf("\\n"))>=0) {const message=JSON.parse(buffer.slice(0,index)); buffer=buffer.slice(index+1); if(message.id===1)console.log(JSON.stringify({jsonrpc:"2.0",id:1,result:{protocolVersion:"2024-11-05"}})); if(message.id===2){${response}} } }`);
  return path;
}
test("canonical RAG protocol preserves sources and uses the requested query", async () => {
  const path = fixture("success", 'console.log(JSON.stringify({jsonrpc:"2.0",id:2,result:{content:[{type:"text",text:"source: docs.md query="+message.params.arguments.query}]}}));');
  const result = await callRagTool("rag_search", { query: "session recall", limit: 2 }, { path, timeoutMs: 1000 });
  expect(result.isError).toBe(false);
  expect(result.content[0].text).toContain("source: docs.md query=session recall");
});
test("RAG errors, missing backend, invalid arguments and hanging processes fail honestly", async () => {
  const path = fixture("error", 'console.log(JSON.stringify({jsonrpc:"2.0",id:2,result:{isError:true,content:[{type:"text",text:"Error: broken embedding"}]}}));');
  expect((await callRagTool("rag_search", { query: "x" }, { path, timeoutMs: 1000 })).isError).toBe(true);
  expect((await callRagTool("rag_search", { query: "x" }, { path: join(scratch, "missing") })).isError).toBe(true);
  expect((await callRagTool("rag_search", { query: "x", collection: "../secret" }, { path })).isError).toBe(true);
  expect((await callRagTool("rag_search", { query: "" }, { path })).isError).toBe(true);
  const hanging = fixture("hang", "");
  const started = Date.now();
  expect((await callRagTool("rag_search", { query: "x" }, { path: hanging, timeoutMs: 80 })).isError).toBe(true);
  expect(Date.now() - started).toBeLessThan(1500);
});

async function gateway(method: string, params: any = {}, token = "fixture") {
  process.env["{{MCP_TOKEN_ENV}}"] = "fixture";
  return (await handler({ req: { method: "POST", header: (name: string) => name === "x-mcp-token" ? token : undefined, query: () => undefined, json: async () => ({ id: 1, method, params }) } } as any)).json() as Promise<any>;
}
test("authenticated gateway advertises RAG and rejects unauthenticated discovery", async () => {
  const result = await gateway("tools/list");
  expect(result.result.tools.map((tool: any) => tool.name)).toContain("rag_search");
  expect(result.result.tools.map((tool: any) => tool.name)).toContain("rag_list_collections");
  expect((await gateway("tools/list", {}, "invalid")).error.code).toBe(-32001);
});
test("upstream auth failover, all text blocks and malformed results", async () => {
  const original = globalThis.fetch;
  const primary = process.env.ZO_API_KEY, fallback = process.env.ZO_ASK_TOKEN;
  process.env.ZO_API_KEY = "bad-fixture"; process.env.ZO_ASK_TOKEN = "good-fixture";
  let calls = 0;
  try {
    globalThis.fetch = (async () => ++calls === 1 ? new Response("denied", { status: 401 }) : Response.json({ result: { content: [{ type: "text", text: "first" }, { type: "text", text: "second" }] } })) as any;
    const good = await gateway("tools/call", { name: "list_automations", arguments: {} });
    expect(good.result.isError).toBe(false); expect(good.result.content[0].text).toBe("first\nsecond"); expect(calls).toBe(2);
    globalThis.fetch = (async () => Response.json({ result: {} })) as any;
    expect((await gateway("tools/call", { name: "list_automations", arguments: {} })).result.isError).toBe(true);
  } finally { globalThis.fetch = original; if (primary === undefined) delete process.env.ZO_API_KEY; else process.env.ZO_API_KEY = primary; if (fallback === undefined) delete process.env.ZO_ASK_TOKEN; else process.env.ZO_ASK_TOKEN = fallback; }
});

test("workspace fallback finds literal content and filenames while excluding nested copies and private paths", async () => {
  const root = join(scratch, "workspace");
  for (const folder of ["Projects/example", "Projects/example/worktrees/copy", "Trash", ".private", "node_modules"]) mkdirSync(join(root, folder), { recursive: true });
  const phrase = "retrieval $(touch NO) | [literal]";
  writeFileSync(join(root, "Projects/example/VOICE.md"), phrase);
  for (const folder of ["Projects/example/worktrees/copy", "Trash", ".private", "node_modules"]) writeFileSync(join(root, folder, "VOICE.md"), phrase);
  symlinkSync("/etc", join(root, "outside"));
  const found = await handleWorkspaceSearch({ query: phrase }, "", { root });
  expect(found.isError).toBe(false);
  expect(JSON.parse(found.content[0].text)).toMatchObject({ count: 1, partial: false });
  const names = await handleWorkspaceSearch({ query: "voice.md", kind: "filename", directory: join(root, "Projects") }, "", { root });
  expect(JSON.parse(names.content[0].text)).toMatchObject({ count: 1, kind: "filename" });
  for (const directory of ["/etc", join(root, "outside"), join(root, "Trash"), join(root, ".private"), join(root, "Projects/example/worktrees")]) {
    expect((await handleWorkspaceSearch({ query: "x", directory }, "", { root })).isError).toBe(true);
  }
  expect((await handleWorkspaceSearch({ query: "x\ny" }, "", { root })).isError).toBe(true);
});

test("workspace fallback marks bounded output and timeout without claiming absence", async () => {
  const root = join(scratch, "many"); mkdirSync(root);
  for (let i = 0; i < 25; i++) writeFileSync(join(root, `${i}.md`), "match");
  const found = await handleWorkspaceSearch({ query: "match" }, "", { root });
  expect(JSON.parse(found.content[0].text)).toMatchObject({ count: 20, partial: true });
  const hanging = join(scratch, "hanging-rg");
  writeFileSync(hanging, "#!/usr/bin/env bun\nawait Bun.sleep(10000);\n"); chmodSync(hanging, 0o700);
  const start = Date.now();
  const failed = await handleWorkspaceSearch({ query: "match" }, "", { root, executable: hanging, timeoutMs: 80 });
  expect(failed.isError).toBe(true);
  expect(JSON.parse(failed.content[0].text)).toMatchObject({ partial: true, timedOut: true });
  expect(Date.now() - start).toBeLessThan(1500);
});
