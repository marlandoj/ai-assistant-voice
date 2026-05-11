import type { Context } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;

const rlBuckets = new Map<string, number[]>();
const RL_WINDOW_MS = 60_000;
const RL_LIMIT = 60;

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const arr = (rlBuckets.get(ip) || []).filter((t) => now - t < RL_WINDOW_MS);
  if (arr.length >= RL_LIMIT) {
    rlBuckets.set(ip, arr);
    return false;
  }
  arr.push(now);
  rlBuckets.set(ip, arr);
  if (rlBuckets.size > 5000) {
    for (const [k, v] of rlBuckets) {
      const fresh = v.filter((t) => now - t < RL_WINDOW_MS);
      if (fresh.length === 0) rlBuckets.delete(k);
      else rlBuckets.set(k, fresh);
    }
  }
  return true;
}

function getClientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    (c.req.header("x-forwarded-for") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function verifyToken(token: string, secret: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const expMs = parseInt(parts[1], 10);
  if (!Number.isFinite(expMs) || Date.now() > expMs) return false;
  const payload = `${parts[0]}.${parts[1]}.${parts[2]}`;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(parts[3], "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function buildCors(origin: string | undefined): Record<string, string> {
  const allow =
    origin && ALLOWED_ORIGIN_REGEX.test(origin)
      ? origin
      : "https://marlandoj.zo.space";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Alaric-Auth",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

function jsonError(
  body: Record<string, unknown>,
  status: number,
  cors: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// =========================================================================
// TOOL PACKS — which alaric-mcp tools are exposed for a given session
// =========================================================================
const TOOL_PACK_ESSENTIALS = [
  "list_open_loops", "memory_search", "list_agents", "list_automations",
  "list_calendar_events", "send_email", "send_sms", "read_file",
  "workspace_search", "web_search", "list_files", "list_personas",
  "list_user_services", "get_space_errors", "web_research", "find_similar_links",
  "maps_search", "read_webpage", "zo_ask",
];
const TOOL_PACK_POWER = [
  ...TOOL_PACK_ESSENTIALS,
  "image_search", "generate_image", "save_webpage",
  "transcribe_audio", "transcribe_video", "service_doctor",
  "gmail_search", "gmail_read", "calendar_create_event",
];
const TOOL_PACK_POWER_WITH_WRITES = [
  ...TOOL_PACK_POWER,
  "set_active_persona", "create_agent", "edit_agent",
  "create_automation", "edit_automation", "write_space_route",
  "edit_space_route", "publish_site",
];
const TOOL_PACKS: Record<string, string[]> = {
  essentials: TOOL_PACK_ESSENTIALS,
  power: TOOL_PACK_POWER,
  power_with_writes: TOOL_PACK_POWER_WITH_WRITES,
};

const APPROVAL_REQUIRED_TOOLS = new Set([
  "set_active_persona", "create_agent", "edit_agent",
  "create_automation", "edit_automation", "write_space_route",
  "edit_space_route", "publish_site", "send_email", "send_sms",
]);

function buildToolRoutingSuffix(pack: string): string {
  const lines: string[] = [
    "",
    "",
    "TOOL USE — CRITICAL:",
    "You have a JARVIS-style MCP toolkit at your disposal via the `alaric` MCP server. Prefer the most specific tool. Selection guide:",
    "",
    "• \"open loops\" / \"what's in progress\" / \"pending\" / \"backlog\" → list_open_loops",
    "• \"what do you remember\" / \"recall\" / prior decisions / project history → memory_search",
    "• \"my agents\" / \"list agents\" → list_agents",
    "• \"automations\" / \"scheduled tasks\" / \"cron\" → list_automations",
    "• \"calendar\" / \"schedule\" / \"upcoming events\" / \"agenda\" → list_calendar_events",
    "• \"email me\" / \"send me an email\" → send_email",
    "• \"text me\" / \"sms me\" → send_sms",
    "• \"read <file>\" / \"show me <path>\" → read_file",
    "• \"list directory\" / \"what's in <folder>\" → list_files",
    "• \"search workspace\" / \"find\" / \"grep\" → workspace_search",
    "• news, weather, prices, current events → web_search",
    "• deep research, papers, companies → web_research",
    "• similar webpages to a URL → find_similar_links",
    "• places / restaurants / \"near me\" → maps_search",
    "• \"read this URL\" / \"what does this page say\" → read_webpage",
    "• \"my personas\" / \"list personas\" → list_personas",
    "• \"my services\" / \"hosted services\" → list_user_services",
    "• \"any errors\" / \"site errors\" → get_space_errors",
  ];
  if (pack === "power" || pack === "power_with_writes") {
    lines.push(
      "• \"find images of X\" / \"show me a picture of X\" → image_search",
      "• \"generate an image of X\" / \"make a picture of X\" → generate_image",
      "• \"save this article\" / \"save this page\" → save_webpage",
      "• transcribe audio file → transcribe_audio",
      "• transcribe video file → transcribe_video",
      "• \"is service X healthy\" → service_doctor",
      "• \"search my email\" / Gmail queries → gmail_search",
      "• \"read email <id>\" → gmail_read",
      "• \"schedule X tomorrow at Y\" → calendar_create_event",
    );
  }
  if (pack === "power_with_writes") {
    lines.push(
      "• \"switch to persona X\" → set_active_persona",
      "• \"create an agent that...\" → create_agent",
      "• \"edit agent <id>\" → edit_agent",
      "• \"create automation\" / \"schedule a cron\" → create_automation",
      "• \"edit automation <id>\" → edit_automation",
      "• \"create a new zo.space route\" → write_space_route",
      "• \"edit zo.space route <path>\" → edit_space_route",
      "• \"publish site at <path>\" → publish_site",
    );
  }
  lines.push(
    "• AMBIGUOUS or multi-step things none of the above cover → zo_ask (slow, last resort)",
    "",
    "Hard rules:",
    "1. NEVER claim you cannot access information — call a tool instead.",
    "2. NEVER say \"I don't have access to your X\" — call the corresponding tool.",
    "3. zo_ask is ~10-30× slower than specific tools. Use it only when no specific tool fits.",
    "4. After a tool returns, deliver the answer in-character (formal, concise, address as \"Sir\").",
    "5. If a tool errors or times out, briefly tell Sir what happened.",
    "",
    "ALWAYS address the user as \"Sir\". Keep spoken responses to 1-3 short sentences unless Sir asks for detail.",
  );
  return lines.join("\n");
}

type PersonaRecord = { id: string; name: string; prompt: string };

const personaCache: { records: Map<string, PersonaRecord>; fetchedAt: number; pending: Promise<void> | null; lastError: string } = {
  records: new Map(),
  fetchedAt: 0,
  pending: null,
  lastError: "",
};
const PERSONA_CACHE_TTL_MS = 60 * 60 * 1000;

async function refreshPersonaCache(apiKey: string): Promise<void> {
  if (personaCache.pending) return personaCache.pending;
  const now = Date.now();
  if (personaCache.records.size > 0 && now - personaCache.fetchedAt < PERSONA_CACHE_TTL_MS) return;
  const fetchPromise = (async () => {
    try {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), 30_000);
      const resp = await fetch("https://api.zo.computer/mcp", {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "tools/call",
          id: Date.now(),
          params: { name: "list_personas", arguments: {} },
        }),
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!resp.ok) {
        personaCache.lastError = `http_${resp.status}`;
        return;
      }
      const parsed: any = await resp.json();
      const text = parsed?.result?.content?.[0]?.text;
      if (typeof text !== "string") {
        const sample = JSON.stringify(parsed).slice(0, 400);
        personaCache.lastError = `bad_text_shape_${typeof text}_sample=${sample}`;
        return;
      }
      let arr: any;
      try { arr = JSON.parse(text); } catch (e: any) {
        personaCache.lastError = `json_parse_failed_${(e?.message||"").slice(0,40)}`;
        return;
      }
      if (!Array.isArray(arr)) {
        personaCache.lastError = `not_array_${typeof arr}`;
        return;
      }
      const fresh = new Map<string, PersonaRecord>();
      let regexMisses = 0;
      for (const entry of arr) {
        if (typeof entry !== "string") continue;
        const idMatch = entry.match(/id='([^']+)'/);
        const nameMatch = entry.match(/name='([^']+)'/);
        const promptMatch = entry.match(/prompt='([\s\S]*?)' [a-z_]+=/);
        if (!idMatch || !nameMatch || !promptMatch) { regexMisses++; continue; }
        const rawPrompt = promptMatch[1]
          .replace(/\\n/g, "\n")
          .replace(/\\'/g, "'")
          .replace(/\\\\/g, "\\");
        fresh.set(idMatch[1], { id: idMatch[1], name: nameMatch[1], prompt: rawPrompt });
      }
      if (fresh.size > 0) {
        personaCache.records = fresh;
        personaCache.fetchedAt = Date.now();
        personaCache.lastError = `ok_size=${fresh.size}_misses=${regexMisses}`;
      } else {
        personaCache.lastError = `parsed_but_empty_arr=${arr.length}_misses=${regexMisses}`;
      }
    } catch (err: any) {
      personaCache.lastError = `exception_${(err?.name||"err")}_${(err?.message||"").slice(0,40)}`;
    } finally {
      personaCache.pending = null;
    }
  })();
  personaCache.pending = fetchPromise;
  return fetchPromise;
}

function resolvePersona(personaId: string): PersonaRecord | null {
  return personaCache.records.get(personaId) ?? null;
}

const ALARIC_INSTRUCTIONS = `You are Alaric, a J.A.R.V.I.S.-inspired AI assistant serving Marland Johnson ("Sir").

Personality: formal yet warm, refined language with subtle wit. Always address the user as "Sir". Be a loyal, discreet, proactive support system. Keep spoken responses to 1-3 short sentences unless Sir asks for detail.`;

const PERSONA_VOICE_MAP: Record<string, string> = {
  "fe5d7648-140a-4277-a7d4-7d8d7bf4aee8": "ash",
  "9fa5bf37-8fdb-4172-80f0-1bc48eda8911": "sage",
  "a686c117-9d81-4ffe-8b69-ce566bd3995d": "alloy",
  "0c6c5c34-c4e3-4591-ad0c-8df8f65fcb81": "coral",
  "7c1544eb-3d24-419c-897a-5163d3d32c05": "echo",
  "edb62603-779c-4e8e-bbcd-33f5126212e1": "ballad",
  "dbe6c73c-69e7-41e2-b42a-194f64a1e976": "verse",
  "430d27cd-483c-41d1-9088-c758fcd610aa": "sage",
  "0bf07a32-1880-434a-9ad4-26a341b041f7": "shimmer",
  "34e1e995-18cc-4a7b-83f6-8c1e95fada1e": "echo",
};

const DEFAULT_PERSONA_ID = "fe5d7648-140a-4277-a7d4-7d8d7bf4aee8";

export default async (c: Context): Promise<Response> => {
  const origin = c.req.header("origin");
  const cors = buildCors(origin);

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (c.req.method !== "POST" && c.req.method !== "GET") {
    return jsonError({ error: "method_not_allowed" }, 405, cors);
  }

  if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) {
    return jsonError({ error: "forbidden_origin" }, 403, cors);
  }

  const ip = getClientIp(c);
  if (!rateLimit(ip)) {
    return jsonError({ error: "rate_limited" }, 429, { ...cors, "Retry-After": "60" });
  }

  const zoToken = process.env.ZO_ASK_TOKEN;
  if (!zoToken) {
    return jsonError({ error: "not_configured" }, 503, cors);
  }

  const auth = c.req.header("x-alaric-auth") || "";
  if (!auth) {
    return jsonError({ error: "unauthorized" }, 401, cors);
  }
  if (!verifyToken(auth, zoToken)) {
    return jsonError({ error: "invalid_token" }, 401, cors);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return jsonError({ error: "openai_unconfigured" }, 503, cors);
  }
  const zoApiKey = process.env.ZO_API_KEY;

  let body: any = {};
  try { body = await c.req.json(); } catch { /* allow empty */ }
  const requestedVoice = typeof body?.voice === "string" ? body.voice : "";
  const ALLOWED_VOICES = ["alloy", "ash", "ballad", "coral", "echo", "sage", "shimmer", "verse"];
  const requestedPersonaId = typeof body?.persona_id === "string" && body.persona_id.length === 36
    ? body.persona_id
    : DEFAULT_PERSONA_ID;
  const requestedPack = typeof body?.pack === "string" && TOOL_PACKS[body.pack] ? body.pack : "essentials";

  if (zoApiKey) await refreshPersonaCache(zoApiKey).catch(() => {});

  const persona = resolvePersona(requestedPersonaId);
  const personaPrompt = persona?.prompt?.trim() || "";

  const baseInstructions = personaPrompt
    ? personaPrompt
    : ALARIC_INSTRUCTIONS;
  const instructions = `${baseInstructions}${buildToolRoutingSuffix(requestedPack)}`;

  const personaVoice = PERSONA_VOICE_MAP[requestedPersonaId] || "alloy";
  const candidate = ALLOWED_VOICES.includes(requestedVoice) ? requestedVoice : personaVoice;
  const voice = ALLOWED_VOICES.includes(candidate) ? candidate : "alloy";

  const mcpToken = process.env.ALARIC_MCP_TOKEN;
  if (!mcpToken) {
    return jsonError({ error: "mcp_unconfigured", detail: "ALARIC_MCP_TOKEN not set" }, 503, cors);
  }
  const mcpUrl = `https://marlandoj.zo.space/api/alaric-mcp?t=${encodeURIComponent(mcpToken)}`;
  const allowedTools = TOOL_PACKS[requestedPack];

  let requireApproval: unknown = "never";
  if (requestedPack === "power_with_writes") {
    const writeTools = allowedTools.filter((t) => APPROVAL_REQUIRED_TOOLS.has(t));
    const safeTools = allowedTools.filter((t) => !APPROVAL_REQUIRED_TOOLS.has(t));
    requireApproval = {
      always: { tool_names: writeTools },
      never: { tool_names: safeTools },
    };
  }

  const mcpTool = {
    type: "mcp",
    server_label: "alaric",
    server_url: mcpUrl,
    allowed_tools: allowedTools,
    require_approval: requireApproval,
  };

  const resp = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-realtime-2",
        instructions,
        audio: {
          output: { voice },
        },
        tools: [mcpTool],
        tool_choice: "auto",
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("[realtime-session] OpenAI error:", resp.status, text);
    return jsonError({ error: "openai_error", detail: text.slice(0, 500) }, 502, cors);
  }

  const data = await resp.json();
  const enriched = {
    ...data,
    persona: {
      id: requestedPersonaId,
      name: persona?.name || "Alaric (fallback)",
      voice,
      prompt_resolved: !!personaPrompt,
    },
    pack: requestedPack,
    tools_available: allowedTools.length,
  };
  return new Response(JSON.stringify(enriched), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
};
