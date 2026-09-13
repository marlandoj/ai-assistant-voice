import { test, expect, afterAll } from "bun:test";
import { createHmac, randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const scratch = mkdtempSync(join(tmpdir(), "zo-task-persona-startup-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const objects = [{ id: "persona", name: "Test Persona", prompt: "Private persona prompt." }];
const catalog = (entries: any[] = objects) => Response.json({ result: { content: [{ type: "text", text: JSON.stringify(entries) }] } });

async function fixture(kind: "live" | "catalog", lookup: (key: string, signal: AbortSignal) => Promise<Response>, run: (call: (body?: any) => Promise<any>, stats: { lookups: string[]; creates: number }) => Promise<void>) {
  const savedFetch = globalThis.fetch;
  const savedEnv = { ...process.env };
  const secret = "fixture-ask";
  process.env.ZO_ASK_TOKEN = secret;
  process.env.ZO_API_KEY = "fixture-api";
  process.env.OPENAI_API_KEY = "fixture-openai";
  process.env.VOICE_LIVE_DB_PATH = join(scratch, `${randomUUID()}.sqlite`);
  const stats = { lookups: [] as string[], creates: 0 };
  const filename = kind === "live" ? "live-route.ts" : "alaric-personas-route.ts";
  const source = (await Bun.file(new URL(`../assets/${filename}`, import.meta.url)).text())
    .replaceAll("{{ZO_HOST}}", "https://test.zo.space").replaceAll("{{ASSISTANT_SLUG}}", "test")
    .replaceAll("{{ASSISTANT_NAME}}", "Test").replaceAll("{{DEFAULT_PERSONA_ID}}", "persona")
    .replaceAll("{{PAGE_PATH}}", "/voice").replaceAll("{{MCP_TOKEN_ENV}}", "MCP_SHARED_TOKEN");
  const path = join(scratch, `${randomUUID()}.ts`);
  await Bun.write(path, source);
  try {
    globalThis.fetch = (async (input: any, init: any) => {
      if (init.method === "HEAD") return new Response(null, { status: 200 });
      if (String(input).endsWith("/mcp")) {
        const key = new Headers(init.headers).get("authorization")!.slice(7);
        stats.lookups.push(key);
        return lookup(key, init.signal);
      }
      if (String(input).endsWith("/live/sessions")) {
        stats.creates++;
        return Response.json({ session: { id: "live_fixture" }, transport: { sdp: "v=0\r\nanswer" } });
      }
      throw new Error("Unexpected fixture request");
    }) as typeof fetch;
    const handler = (await import(path)).default;
    const call = async (body?: any) => {
      const payload = `v1.${Date.now() + 60000}.fixture`;
      const token = `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
      const headers = new Headers({ Origin: "https://test.zo.space", "X-Test-Auth": token, "X-Alaric-Auth": token, Cookie: `valid=${randomUUID()}` });
      const response = await handler({ req: { method: kind === "live" ? "POST" : "GET", header: (key: string) => headers.get(key) || undefined, text: async () => JSON.stringify(body || { action: "create", request_id: randomUUID(), sdp: "v=0\r\n", persona_id: "persona" }) } });
      return { status: response.status, data: await response.json() };
    };
    await run(call, stats);
  } finally {
    globalThis.fetch = savedFetch;
    for (const key of ["ZO_ASK_TOKEN", "ZO_API_KEY", "OPENAI_API_KEY", "VOICE_LIVE_DB_PATH"]) {
      if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
    }
  }
}

test("startup tolerates actual 16-second persona latency then caches the catalog", async () => {
  await fixture("live", async (_key, signal) => {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, 16000);
      signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
    return catalog();
  }, async (call, stats) => {
    expect((await call()).status).toBe(201);
    expect((await call()).status).toBe(201);
    expect(stats.lookups).toEqual(["fixture-ask"]);
    expect(stats.creates).toBe(2);
  });
}, 20000);

test("simultaneous starts share one lookup but keep distinct session creation", async () => {
  await fixture("live", async () => { await Bun.sleep(20); return catalog(); }, async (call, stats) => {
    const results = await Promise.all([call(), call()]);
    expect(results.map(result => result.status)).toEqual([201, 201]);
    expect(stats.lookups).toHaveLength(1);
    expect(stats.creates).toBe(2);
  });
});

for (const kind of ["live", "catalog"] as const) {
  test(`${kind} falls back after HTTP-200 RPC rejection without exposing prompts`, async () => {
    await fixture(kind, async key => key === "fixture-ask" ? Response.json({ error: { code: -32001 } }) : catalog(), async (call, stats) => {
      const result = await call();
      expect(result.status).toBe(kind === "live" ? 201 : 200);
      expect(stats.lookups).toEqual(["fixture-ask", "fixture-api"]);
      expect(JSON.stringify(result.data)).not.toContain("Private persona prompt");
    });
  });
  test(`${kind} falls back after transport timeout with a fresh signal`, async () => {
    let first: AbortSignal;
    await fixture(kind, async (key, signal) => {
      if (key === "fixture-ask") { first = signal; throw new DOMException("Timeout", "TimeoutError"); }
      expect(signal).not.toBe(first);
      expect(signal.aborted).toBe(false);
      return catalog();
    }, async (call) => { expect((await call()).status).toBe(kind === "live" ? 201 : 200); });
  });
  test(`${kind} supports the production string catalog`, async () => {
    await fixture(kind, async () => catalog(["Persona(id='persona' name='Test Persona' prompt='Private persona prompt.' model='fixture')"]), async call => {
      const result = await call();
      expect(result.status).toBe(kind === "live" ? 201 : 200);
      expect(JSON.stringify(result.data)).not.toContain("Private persona prompt");
    });
  });
}

test("unavailable personas never reach OpenAI and a later fresh start recovers", async () => {
  let healthy = false;
  await fixture("live", async () => healthy ? catalog() : Response.json({ result: { isError: true } }), async (call, stats) => {
    const result = await call();
    expect(result.status).toBe(503);
    expect(result.data.error).toBe("persona_unavailable");
    expect(result.data.message).toContain("Start conversation");
    expect(stats.creates).toBe(0);
    healthy = true;
    expect((await call()).status).toBe(201);
    expect(stats.creates).toBe(1);
  });
});

test("unknown persona cannot substitute another identity", async () => {
  await fixture("live", async () => catalog(), async (call, stats) => {
    expect((await call({ action: "create", request_id: randomUUID(), sdp: "v=0\r\n", persona_id: "deleted" })).status).toBe(503);
    expect(stats.creates).toBe(0);
  });
});

test("expired persona cache cannot hide an upstream outage", async () => {
  const now = Date.now;
  let healthy = true;
  try {
    await fixture("live", async () => healthy ? catalog() : Response.json({ error: { code: -32001 } }), async (call, stats) => {
      expect((await call()).status).toBe(201);
      healthy = false;
      const future = now() + 6 * 60000;
      Date.now = () => future;
      expect((await call()).status).toBe(503);
      expect(stats.creates).toBe(1);
      expect(stats.lookups).toHaveLength(3);
    });
  } finally { Date.now = now; }
});

test("credential rotation invalidates cached persona data", async () => {
  let healthy = true;
  await fixture("live", async () => healthy ? catalog() : new Response(null, { status: 401 }), async (call, stats) => {
    expect((await call()).status).toBe(201);
    healthy = false;
    process.env.ZO_API_KEY = "rotated-fixture";
    expect((await call()).status).toBe(503);
    expect(stats.creates).toBe(1);
  });
});
