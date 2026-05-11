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

const PERSONAS = [
  { id: "fe5d7648-140a-4277-a7d4-7d8d7bf4aee8", name: "Alaric Voice", group: "Alaric", voice: "ash" },
  { id: "9fa5bf37-8fdb-4172-80f0-1bc48eda8911", name: "Alaric", group: "Alaric", voice: "sage" },
  { id: "a686c117-9d81-4ffe-8b69-ce566bd3995d", name: "Alaric · Fast", group: "Alaric", voice: "alloy" },
  { id: "0c6c5c34-c4e3-4591-ad0c-8df8f65fcb81", name: "Alaric · Light", group: "Alaric", voice: "coral" },
  { id: "7c1544eb-3d24-419c-897a-5163d3d32c05", name: "Alaric · Deep", group: "Alaric", voice: "echo" },
  { id: "edb62603-779c-4e8e-bbcd-33f5126212e1", name: "Mimir", group: "Core", voice: "ballad" },
  { id: "dbe6c73c-69e7-41e2-b42a-194f64a1e976", name: "Hermes", group: "Core", voice: "verse" },
  { id: "3be5c105-730c-45b9-968c-94aa464e2990", name: "Memory Manager", group: "Core", voice: "alloy" },
  { id: "f188bdf4-ef18-40de-909c-170baae37608", name: "Zouroboros Engineer", group: "Core", voice: "alloy" },
  { id: "c9fef4df-091b-4e41-a51a-23479d9cf3eb", name: "Claude Code", group: "Core", voice: "alloy" },
  { id: "5840f80f-d2f2-4e2c-8cf4-0e1cf88d3c97", name: "Gemini CLI", group: "Core", voice: "alloy" },
  { id: "beb55a68-6918-4245-b20b-2b8b143113e1", name: "Codex CLI", group: "Core", voice: "alloy" },
  { id: "a7c871bc-4a53-41be-8435-10315ed4fdc5", name: "Zo Reporting", group: "Core", voice: "alloy" },
  { id: "430d27cd-483c-41d1-9088-c758fcd610aa", name: "Sage", group: "Core", voice: "sage" },
  { id: "0bf07a32-1880-434a-9ad4-26a341b041f7", name: "Ember", group: "Core", voice: "shimmer" },
  { id: "34e1e995-18cc-4a7b-83f6-8c1e95fada1e", name: "Orion", group: "Core", voice: "echo" },
  { id: "2bf315cc-df19-4ab8-a756-b9521f954c38", name: "Frontend Developer", group: "Engineering", voice: "alloy" },
  { id: "3d488f60-69f6-4101-82d6-a244afd631a7", name: "Backend Architect", group: "Engineering", voice: "alloy" },
  { id: "3a3ac067-dab7-428d-9c7e-9d900587b375", name: "AI Engineer", group: "Engineering", voice: "alloy" },
  { id: "58353f73-66e0-4d05-983f-d083f750fc61", name: "DevOps Automator", group: "Engineering", voice: "alloy" },
  { id: "b8c64600-9c6e-43ad-88cf-2d7d5f6b650c", name: "Mobile App Builder", group: "Engineering", voice: "alloy" },
  { id: "1c39b0ef-60d9-4884-886f-db412ecce60b", name: "Rapid Prototyper", group: "Engineering", voice: "alloy" },
  { id: "bd109505-7bdd-4c9b-a68a-53e0f1af3431", name: "Senior Developer", group: "Engineering", voice: "alloy" },
  { id: "9d3a0c19-2543-40ad-a183-39c1c95ffba0", name: "N8N Workflow Engineer", group: "Engineering", voice: "alloy" },
  { id: "afb3ce5d-942a-4e29-8960-a0c669c9f30b", name: "PowerShell Expert", group: "Engineering", voice: "alloy" },
  { id: "24d59321-ea8b-4cee-a732-b45412dc1bbb", name: "Security Engineer", group: "Engineering", voice: "alloy" },
  { id: "931d1b3c-88fb-49e3-8097-80f31b2f2ba7", name: "LSP Index Engineer", group: "Engineering", voice: "alloy" },
  { id: "e53dd88d-cbab-463d-8412-120106fb8e65", name: "Reality Checker", group: "Quality", voice: "alloy" },
  { id: "a47ad44b-b769-4710-bbfc-e1d7b678c935", name: "API Tester", group: "Quality", voice: "alloy" },
  { id: "05ffcba2-2b6c-47d3-9ca9-af8c72642ab0", name: "Evidence Collector", group: "Quality", voice: "alloy" },
  { id: "18531155-0d01-46ca-9ab7-fbb6a9cf3972", name: "Performance Benchmarker", group: "Quality", voice: "alloy" },
  { id: "4e65d3d6-f2cc-4b96-8635-2ec6d1f93e72", name: "Testing Reality Checker", group: "Quality", voice: "alloy" },
  { id: "9c594bf9-943d-4c2b-adcd-ddfd98641ed8", name: "Test Results Analyzer", group: "Quality", voice: "alloy" },
  { id: "d343b69f-ad9d-4513-8708-393ebfdb2b72", name: "Tool Evaluator", group: "Quality", voice: "alloy" },
  { id: "e35449fe-b118-4f61-bde6-9215e160738e", name: "Workflow Optimizer", group: "Quality", voice: "alloy" },
  { id: "6b24a919-6b96-4cd1-8387-b966635272e9", name: "UI Designer", group: "Design", voice: "coral" },
  { id: "31145e35-d391-4bef-9521-d7f9b88edc83", name: "Brand Guardian", group: "Design", voice: "coral" },
  { id: "3b0e29ac-952a-49bc-8424-ce22804dc5aa", name: "ArchitectUX", group: "Design", voice: "coral" },
  { id: "f0750dce-3ab5-433e-b711-98af5c757562", name: "UX Researcher", group: "Design", voice: "coral" },
  { id: "4dfb3c27-303b-47c9-8a02-2aac865b677b", name: "Visual Storyteller", group: "Design", voice: "shimmer" },
  { id: "5efeef48-8e19-4333-ab23-5b76c63966a5", name: "Whimsy Injector", group: "Design", voice: "shimmer" },
  { id: "644b9189-032d-4407-adc3-f0473e7bcb58", name: "Marketing Content Creator", group: "Marketing", voice: "verse" },
  { id: "9b81ccc3-d431-4780-a4aa-c78c3a76330d", name: "Marketing Growth Hacker", group: "Marketing", voice: "verse" },
  { id: "7b8db980-78d6-411d-ab2d-5e3f9ca935f2", name: "Marketing Instagram Curator", group: "Marketing", voice: "verse" },
  { id: "75d1df62-06e6-44cc-977d-ed40fdafb0b9", name: "Marketing Reddit Community Builder", group: "Marketing", voice: "verse" },
  { id: "41b9bff6-59f1-4019-8c70-bb3abacd833b", name: "Twitter Engager", group: "Marketing", voice: "verse" },
  { id: "49b4ce78-4181-45b3-a187-ba177097527e", name: "Marketing TikTok Strategist", group: "Marketing", voice: "verse" },
  { id: "619f9e48-1ebc-4498-9c0b-1eaa5a306f94", name: "Marketing Twitter Engager", group: "Marketing", voice: "verse" },
  { id: "8c72c7e9-2c7c-4f10-b53e-ab8286e2442f", name: "Marketing Social Media Strategist", group: "Marketing", voice: "verse" },
  { id: "fb2cb01c-0f21-4d5d-9b1f-de008dc4bacc", name: "content-strategist", group: "Marketing", voice: "verse" },
  { id: "9d2956cd-9b61-4e18-be3c-938c998f8879", name: "Technical Writer", group: "Marketing", voice: "ballad" },
  { id: "7187316e-a6ba-4e38-a928-78322cd1b5dd", name: "App Store Optimizer", group: "Marketing", voice: "verse" },
  { id: "7b456517-1224-4d45-9d55-0eef999e9242", name: "Product Feedback Synthesizer", group: "Product", voice: "alloy" },
  { id: "824ed8f6-d829-4420-a12a-1e1c1a37e298", name: "Product Sprint Prioritizer", group: "Product", voice: "alloy" },
  { id: "bd283abb-798f-4915-a6ba-cae6f0b805b2", name: "Product Trend Researcher", group: "Product", voice: "alloy" },
  { id: "9898f4d1-12fb-42c8-8a94-a30ac104a3fc", name: "Experiment Tracker", group: "Product", voice: "alloy" },
  { id: "c2feb790-da7b-4c4d-9d25-c7dee681cfb2", name: "Project Shepherd", group: "Product", voice: "alloy" },
  { id: "953d5eb8-1cb7-4b38-b571-8a4a77b57875", name: "Studio Operations", group: "Product", voice: "alloy" },
  { id: "b5a1e048-73e8-40ff-9759-1832bf7eb87f", name: "Studio Producer", group: "Product", voice: "alloy" },
  { id: "81f61fcc-d823-4f75-b799-26653bd1acc6", name: "Senior Project Manager", group: "Product", voice: "alloy" },
  { id: "ab9fa0cf-3b80-4343-8653-451b0c725ed7", name: "macOS Spatial Metal Engineer", group: "XR", voice: "alloy" },
  { id: "adef56b5-9c7f-43df-82a4-11f5248887e4", name: "Terminal Integration Specialist", group: "XR", voice: "alloy" },
  { id: "47bd6b33-935b-4cf5-bc00-ba80f18b29e4", name: "visionOS Spatial Engineer", group: "XR", voice: "alloy" },
  { id: "a55e99be-7503-4c0e-a50d-1150cbe34d04", name: "XR Cockpit Interaction Specialist", group: "XR", voice: "alloy" },
  { id: "680a2d69-a5d7-4ad8-8443-e5dec3445814", name: "XR Immersive Developer", group: "XR", voice: "alloy" },
  { id: "5520b598-c869-494e-a301-a580157bceed", name: "XR Interface Architect", group: "XR", voice: "alloy" },
  { id: "2cdd72f5-2f5c-4428-a948-08b8634a9387", name: "Agents Orchestrator", group: "Operations", voice: "alloy" },
  { id: "8317888a-1cba-4298-9715-7096e7cb6b44", name: "Data Analytics Reporter", group: "Operations", voice: "alloy" },
  { id: "827fc3e1-43b9-4641-9244-17ca4d69ff79", name: "Analytics Reporter", group: "Operations", voice: "alloy" },
  { id: "1526b870-9759-41fb-b578-b57deab75430", name: "Executive Summary Generator", group: "Operations", voice: "alloy" },
  { id: "775023b6-93de-4b9d-acc3-7412b2140388", name: "Finance Tracker", group: "Operations", voice: "alloy" },
  { id: "b365263e-de4c-4669-a5b5-eda772376ab0", name: "Infrastructure Maintainer", group: "Operations", voice: "alloy" },
  { id: "2d95abd1-5270-4bc2-9551-0d515508b196", name: "Legal Compliance Checker", group: "Operations", voice: "alloy" },
  { id: "454dde48-82aa-4de6-a6cd-06cb415c549a", name: "Support Responder", group: "Operations", voice: "alloy" },
  { id: "b787f782-1d1a-413e-934e-6ead95381bd8", name: "Financial-Advisor", group: "Operations", voice: "ballad" },
  { id: "a610972e-fb54-43f5-8383-a7b91a4fbd42", name: "Video Producer", group: "Operations", voice: "verse" },
  { id: "d9d3819e-cb13-41f5-84d6-b26fa88639ed", name: "Vance — AlaricAI Sales Representative", group: "AlaricAI", voice: "verse" },
  { id: "676f8bd8-fc12-4b52-abf1-a29e77d8b5f8", name: "Nadia — AlaricAI Client Success Manager", group: "AlaricAI", voice: "shimmer" },
  { id: "dede460c-9492-4298-8ed2-e7ea114266fe", name: "Kieran — AlaricAI Solutions Architect", group: "AlaricAI", voice: "echo" },
  { id: "55e6f73a-3254-4246-9e2c-e2d55a60b11d", name: "Cassian — Aventurine Capital Market Analyst", group: "Aventurine", voice: "ballad" },
  { id: "c24fd600-3688-4bfc-9e5b-511a7640a70e", name: "Theron — Aventurine Capital Compliance Officer", group: "Aventurine", voice: "echo" },
  { id: "c7c6ac54-e7bd-44bd-800e-2f14f2b979ca", name: "Lyra — Aventurine Capital Support Specialist", group: "Aventurine", voice: "coral" },
];

const ETAG = `"v2-${PERSONAS.length}"`;
const PAYLOAD = JSON.stringify({ personas: PERSONAS, count: PERSONAS.length });

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
    return jsonError({ error: "not_configured" }, 503, cors);
  }

  const auth = c.req.header("x-alaric-auth") || "";
  if (!auth) {
    return jsonError({ error: "unauthorized" }, 401, cors);
  }
  if (!verifyToken(auth, zoToken)) {
    return jsonError({ error: "invalid_token" }, 401, cors);
  }

  const ifNone = c.req.header("if-none-match");
  if (ifNone === ETAG) {
    return new Response(null, { status: 304, headers: { ...cors, ETag: ETAG } });
  }

  return new Response(PAYLOAD, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=300",
      ETag: ETAG,
    },
  });
};
