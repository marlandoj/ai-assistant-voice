// /api/<slug>-personas — dynamic catalog of the host user's Zo personas.
//
// Calls the upstream `list_personas` MCP tool at api.zo.computer/mcp and
// returns a normalized {id, name} array. ETag/Cache-Control hold the list
// stable for 5 min so the PWA dropdown doesn't refetch on every load.
//
// Auth: x-alaric-auth HMAC token issued by /api/<slug>-bootstrap.
//
// Required Zo Secrets:
//   ZO_ASK_TOKEN — HMAC secret used to verify the session token
//   ZO_API_KEY   — used to call api.zo.computer/mcp upstream

import type { Context } from "hono";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const ALLOWED_ORIGIN_REGEX = /^https?:\/\/([a-z0-9-]+\.)?zo\.(computer|space)$/;
const ZO_MCP_ENDPOINT = "https://api.zo.computer/mcp";

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
      : "{{ZO_HOST}}";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
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

// ──────────────────────────────────────────────────────────────────────────
// Persona cache — single in-memory snapshot, refreshed every 5 minutes.
// Personas rarely change, so cross-request sharing is safe and cheap.
// ──────────────────────────────────────────────────────────────────────────
type Persona = { id: string; name: string };

const cache: {
  personas: Persona[];
  payload: string;
  etag: string;
  fetchedAt: number;
  pending: Promise<void> | null;
  lastError: string;
} = {
  personas: [],
  payload: "",
  etag: '""',
  fetchedAt: 0,
  pending: null,
  lastError: "",
};
const CACHE_TTL_MS = 5 * 60 * 1000;

async function refreshCache(): Promise<void> {
  if (cache.pending) return cache.pending;
  const now = Date.now();
  if (cache.personas.length > 0 && now - cache.fetchedAt < CACHE_TTL_MS) return;
  const p = (async () => {
    try {
      let arr: any[] = [];
      const deadline = AbortSignal.timeout(35000);
      const keys = [...new Set([process.env.ZO_ASK_TOKEN, process.env.ZO_API_KEY].filter((key): key is string => !!key))];
      for (const key of keys) {
        try {
          const resp = await fetch(ZO_MCP_ENDPOINT, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", method: "tools/call", id: Date.now(), params: { name: "list_personas", arguments: {} } }),
            signal: AbortSignal.any([deadline, AbortSignal.timeout(25000)]),
          });
          if (!resp.ok) { cache.lastError = `http_${resp.status}`; continue; }
          const parsed: any = await resp.json();
          if (parsed.error || parsed.result?.isError) { cache.lastError = "upstream_error"; continue; }
          const entries = JSON.parse(parsed.result?.content?.[0]?.text || "null");
          if (!Array.isArray(entries) || !entries.length) { cache.lastError = "invalid_catalog"; continue; }
          arr = entries;
          break;
        } catch {
          cache.lastError = "upstream_unavailable";
          if (deadline.aborted) break;
        }
      }
      const fresh: Persona[] = [];
      for (const entry of arr) {
        if (entry && typeof entry === "object" && typeof entry.id === "string" && typeof entry.name === "string") {
          fresh.push({ id: entry.id, name: entry.name });
          continue;
        }
        if (typeof entry !== "string") continue;
        const idMatch = entry.match(/id='([^']+)'/);
        const nameMatch = entry.match(/name='([^']+)'/);
        if (!idMatch || !nameMatch) continue;
        fresh.push({ id: idMatch[1], name: nameMatch[1] });
      }
      if (fresh.length === 0) {
        cache.lastError = `parsed_empty`;
        return;
      }
      const payload = JSON.stringify({ personas: fresh, count: fresh.length });
      const etag = `"v3-${createHash("sha256").update(payload).digest("hex").slice(0, 16)}"`;
      cache.personas = fresh;
      cache.payload = payload;
      cache.etag = etag;
      cache.fetchedAt = Date.now();
      cache.lastError = `ok_size=${fresh.length}`;
    } catch (err: any) {
      cache.lastError = `exception_${(err?.name||"err")}`;
    } finally {
      cache.pending = null;
    }
  })();
  cache.pending = p;
  return p;
}

export default async (c: Context): Promise<Response> => {
  const origin = c.req.header("origin");
  const cors = buildCors(origin);

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (c.req.method !== "GET") {
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
    return jsonError({ error: "not_configured", detail: "ZO_ASK_TOKEN missing" }, 503, cors);
  }

  const auth = c.req.header("x-alaric-auth") || "";
  if (!auth) {
    return jsonError({ error: "unauthorized" }, 401, cors);
  }
  if (!verifyToken(auth, zoToken)) {
    return jsonError({ error: "invalid_token" }, 401, cors);
  }

  await refreshCache().catch(() => {});

  if (cache.personas.length === 0) {
    return jsonError(
      { error: "personas_unavailable", detail: cache.lastError || "unknown" },
      502,
      cors,
    );
  }

  const ifNone = c.req.header("if-none-match");
  if (ifNone === cache.etag) {
    return new Response(null, { status: 304, headers: { ...cors, ETag: cache.etag } });
  }

  return new Response(cache.payload, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
      ETag: cache.etag,
    },
  });
};
