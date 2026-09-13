import { expect, test } from "bun:test";
import handler, { handleCurrentTime } from "../assets/alaric-mcp-route.ts";

function clock(zone: string, instant: string) {
  const result = handleCurrentTime({ time_zone: zone }, new Date(instant));
  expect(result.isError).toBe(false);
  return JSON.parse(result.content[0].text);
}
test("Los Angeles observes winter and summer offsets; Phoenix is independent", () => {
  expect(clock("America/Los_Angeles", "2026-01-13T01:05:00Z")).toMatchObject({ local_date: "2026-01-12", local_time: "5:05:00 PM", zone_abbreviation: "PST", utc_offset: "UTC-08:00" });
  expect(clock("Los Angeles", "2026-09-13T01:05:00Z")).toMatchObject({ local_date: "2026-09-12", local_time: "6:05:00 PM", zone_abbreviation: "PDT", utc_offset: "UTC-07:00" });
  expect(clock("America/Phoenix", "2026-01-13T01:05:00Z")).toMatchObject({ local_time: "6:05:00 PM", utc_offset: "UTC-07:00" });
});
test("Los Angeles clock handles spring skip and fall repeat", () => {
  expect(clock("America/Los_Angeles", "2026-03-08T09:59:59Z").local_time).toBe("1:59:59 AM");
  expect(clock("America/Los_Angeles", "2026-03-08T10:00:00Z")).toMatchObject({ local_time: "3:00:00 AM", zone_abbreviation: "PDT" });
  expect(clock("America/Los_Angeles", "2026-11-01T08:59:59Z").local_time).toBe("1:59:59 AM");
  expect(clock("America/Los_Angeles", "2026-11-01T09:00:00Z")).toMatchObject({ local_time: "1:00:00 AM", zone_abbreviation: "PST" });
});
test("invalid zones and arguments never silently return Arizona time", () => {
  for (const args of [{time_zone:"Mars/Olympus"}, {time_zone:"PST"}, {time_zone:""}, {time_zone:null}, {time_zone:42}, {timezone:"America/Los_Angeles"}, {time_zone:"toString"}, []]) expect(handleCurrentTime(args).isError).toBe(true);
  expect(JSON.parse(handleCurrentTime({}).content[0].text).time_zone).toBe("America/Phoenix");
  expect(clock("Asia/Tokyo", "2026-09-13T23:05:00Z")).toMatchObject({ local_date:"2026-09-14", local_time:"8:05:00 AM", utc_offset:"UTC+09:00" });
});
test("authenticated MCP clock is fresh, discoverable, and needs no upstream credentials", async () => {
  const before = Date.now();
  const old = { key: process.env.ZO_API_KEY, ask: process.env.ZO_ASK_TOKEN, token: process.env["{{MCP_TOKEN_ENV}}"] };
  process.env["{{MCP_TOKEN_ENV}}"] = "clock-fixture";
  delete process.env.ZO_API_KEY; delete process.env.ZO_ASK_TOKEN;
  const call = async (method: string, token = "clock-fixture") => (await handler({ req: { method:"POST", header:(key:string)=>key==="x-mcp-token"?token:undefined, query:()=>undefined, json:async()=>({id:1,method,params:{name:"get_current_time",arguments:{time_zone:"America/Los_Angeles"}}}) } } as any)).json() as Promise<any>;
  try {
    expect((await call("tools/list")).result.tools.some((t:any)=>t.name==="get_current_time")).toBe(true);
    expect((await call("tools/call", "invalid")).error.code).toBe(-32001);
    const first = (await call("tools/call")).result.structuredContent;
    await Bun.sleep(5);
    const second = (await call("tools/call")).result.structuredContent;
    expect(Date.parse(first.observed_at)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(second.observed_at)).toBeGreaterThan(Date.parse(first.observed_at));
    expect(Date.parse(second.observed_at)).toBeLessThanOrEqual(Date.now());
    expect(second.time_zone).toBe("America/Los_Angeles");
  } finally {
    for (const [key,value] of [["ZO_API_KEY",old.key],["ZO_ASK_TOKEN",old.ask],["{{MCP_TOKEN_ENV}}",old.token]]) { if(value===undefined)delete process.env[key!];else process.env[key!]=value; }
  }
});
