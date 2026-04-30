#!/usr/bin/env bun
/**
 * Full installer for AI Assistant Voice on any Zo Computer.
 *
 * Usage:
 *   bun deploy-tts-endpoint.ts                        # Deploy TTS only (ElevenLabs)
 *   bun deploy-tts-endpoint.ts --backend openai       # Deploy TTS only (OpenAI)
 *   bun deploy-tts-endpoint.ts --backend edge         # Deploy TTS only (edge-tts)
 *   bun deploy-tts-endpoint.ts --deploy-all           # Deploy all routes + PWA page
 *   bun deploy-tts-endpoint.ts --deploy-all --backend openai
 *   bun deploy-tts-endpoint.ts --deploy-all \
 *       --name "Aria" \
 *       --path "/aria" \
 *       --persona-id "your-persona-uuid"
 *   bun deploy-tts-endpoint.ts --host myhandle.zo.space
 *
 * Routes deployed:
 *   /api/tts              — TTS proxy (keeps API key server-side)
 *   /api/ai-ask           — Zo ask proxy (ZO_ASK_TOKEN secret required)
 *   /api/realtime-session — OpenAI Realtime session token (OPENAI_API_KEY required)
 *   /<path>               — The voice PWA page  (--deploy-all only)
 *
 * One-time prerequisites:
 *   1. ZO_CLIENT_IDENTITY_TOKEN — auto-available on Zo server
 *   2. ZO_ASK_TOKEN in Zo Secrets — Settings > Advanced > Access Tokens → add as secret
 *   3. TTS secret:
 *        ElevenLabs: ELEVENLABS_API_KEY
 *        OpenAI:     OPENAI_API_KEY
 *        edge-tts:   none (run setup-edge-tts.sh once first)
 *   4. OPENAI_API_KEY — only if you want the GPT Realtime mode
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS    = join(__dirname, "../assets");

// ─── CLI args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const deployAll    = args.includes("--deploy-all");
const backend      = (flag("--backend") ?? "elevenlabs").toLowerCase();
const rawHost      = flag("--host") ?? process.env.ZO_SPACE_HOST ?? "";
const assistName   = flag("--name") ?? "My Assistant";
const pagePath     = flag("--path") ?? "/ai-assistant-voice";
const personaId    = flag("--persona-id") ?? "";

// Derive handle from env or host arg
const ZO_HANDLE    = rawHost
  ? rawHost.replace(/^https?:\/\//, "").replace(".zo.space", "")
  : (process.env.ZO_HANDLE ?? "");

if (!ZO_HANDLE && !process.env.ZO_CLIENT_IDENTITY_TOKEN) {
  console.error("❌  Could not determine Zo handle. Pass --host yourhandle.zo.space");
  process.exit(1);
}

const ZO_SPACE_HOST = `https://${ZO_HANDLE}.zo.space`;

// ─── Backend config ───────────────────────────────────────────────────────────
const BACKENDS: Record<string, { file: string; secret?: string }> = {
  elevenlabs: { file: "tts-route.ts",        secret: "ELEVENLABS_API_KEY" },
  openai:     { file: "tts-route-openai.ts", secret: "OPENAI_API_KEY" },
  edge:       { file: "tts-route-edge.ts" },
};

const cfg = BACKENDS[backend];
if (!cfg) {
  console.error(`❌  Unknown backend "${backend}". Choose: elevenlabs | openai | edge`);
  process.exit(1);
}

const IDENTITY_TOKEN = process.env.ZO_CLIENT_IDENTITY_TOKEN;
if (!IDENTITY_TOKEN) {
  console.error("❌  ZO_CLIENT_IDENTITY_TOKEN not set. Run this on your Zo server.");
  process.exit(1);
}

// ─── Zo API helper ────────────────────────────────────────────────────────────
async function deployRoute(
  label: string,
  path: string,
  code: string,
  routeType: "api" | "page" = "api",
): Promise<void> {
  console.log(`📡  Deploying ${path} [${label}] …`);

  const instruction = routeType === "page"
    ? `Create (or overwrite) a zo.space PAGE route at path \`${path}\` with route_type=page and public=false. Use EXACTLY this TypeScript/TSX code:\n\`\`\`tsx\n${code}\n\`\`\`\nAfter creating call get_space_errors(). Reply: OK or ERROR:<reason>`
    : `Create (or overwrite) a zo.space API route at path \`${path}\` with route_type=api and public=true. Use EXACTLY this TypeScript code:\n\`\`\`typescript\n${code}\n\`\`\`\nAfter creating call get_space_errors(). Reply: OK or ERROR:<reason>`;

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: IDENTITY_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: instruction,
      model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
    }),
  });

  if (!res.ok) throw new Error(`Zo API error: ${res.status} ${await res.text()}`);

  const data = await res.json() as { output: string };
  const output = (data.output ?? "").trim();

  if (output.startsWith("ERROR")) throw new Error(`Deploy failed: ${output}`);

  console.log(`✅  ${path} → ${ZO_SPACE_HOST}${path}`);
}

// ─── Deploy /api/tts ──────────────────────────────────────────────────────────
const ttsCode = readFileSync(join(ASSETS, cfg.file), "utf8");
if (cfg.secret) console.log(`    ℹ️   Requires secret: ${cfg.secret} (Settings > Advanced)`);

try {
  await deployRoute(backend, "/api/tts", ttsCode);
} catch (err) {
  console.error("❌ ", err);
  process.exit(1);
}

// ─── Deploy remaining routes (--deploy-all) ───────────────────────────────────
if (deployAll) {
  // /api/ai-ask
  const askCode = readFileSync(join(ASSETS, "ai-ask-route.ts"), "utf8");
  console.log("    ℹ️   Requires secret: ZO_ASK_TOKEN (Settings > Advanced > Access Tokens → Secrets)");
  try {
    await deployRoute("ai-ask", "/api/ai-ask", askCode);
  } catch (err) {
    console.error("❌ ", err);
    process.exit(1);
  }

  // /api/realtime-session
  const rtCode = readFileSync(join(ASSETS, "realtime-session-route.ts"), "utf8");
  console.log("    ℹ️   Requires secret: OPENAI_API_KEY (for Realtime mode)");
  try {
    await deployRoute("realtime-session", "/api/realtime-session", rtCode);
  } catch (err) {
    console.error("⚠️   /api/realtime-session failed (non-fatal — Realtime mode won't work):", err);
  }

  // Build persona options JSON
  const personaOptions = personaId
    ? `[{ "label": "${assistName}", "value": "${personaId}" }]`
    : `[]`;

  // Build assistant slug (lowercase, no spaces)
  const assistSlug = assistName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  // /page route — substitute placeholders
  let pwaCode = readFileSync(join(ASSETS, "pwa-page.tsx"), "utf8");
  pwaCode = pwaCode
    .replace(/\{\{ZO_HOST\}\}/g,         ZO_SPACE_HOST)
    .replace(/\{\{ASSISTANT_NAME\}\}/g,  assistName)
    .replace(/\{\{ASSISTANT_SLUG\}\}/g,  assistSlug)
    .replace(/\{\{PERSONA_OPTIONS\}\}/g, personaOptions)
    .replace(/\{\{PAGE_PATH\}\}/g,       pagePath)
    .replace(/\{\{PORTRAIT_PATH\}\}/g,   "/images/assistant-portrait.png");

  try {
    await deployRoute("pwa-page", pagePath, pwaCode, "page");
  } catch (err) {
    console.error("❌ ", err);
    process.exit(1);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────────────────────────");
console.log("✅  AI Assistant Voice installation complete!\n");
console.log(`Zo Space Host : ${ZO_SPACE_HOST}`);
if (deployAll) {
  console.log(`PWA Page      : ${ZO_SPACE_HOST}${pagePath}  (private — sign in to view)`);
  console.log(`AI Proxy      : ${ZO_SPACE_HOST}/api/ai-ask`);
  console.log(`TTS Proxy     : ${ZO_SPACE_HOST}/api/tts`);
  console.log(`RT Sessions   : ${ZO_SPACE_HOST}/api/realtime-session`);
}
console.log("\nRequired secrets (Settings > Advanced):");
if (cfg.secret) console.log(`  ${cfg.secret.padEnd(25)} — TTS API key`);
if (deployAll)  console.log(`  ZO_ASK_TOKEN              — Zo access token for the AI proxy`);
if (deployAll)  console.log(`  OPENAI_API_KEY            — Only needed for Realtime mode`);
if (!cfg.secret) console.log("  (none for edge-tts — run setup-edge-tts.sh once)");
console.log("────────────────────────────────────────────────────────────\n");
