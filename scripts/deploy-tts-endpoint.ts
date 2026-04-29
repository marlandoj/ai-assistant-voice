#!/usr/bin/env bun
/**
 * Deploy persona-voice proxy routes to zo.space.
 *
 * Usage:
 *   bun deploy-tts-endpoint.ts                         # TTS only — ElevenLabs (default)
 *   bun deploy-tts-endpoint.ts --backend openai        # TTS only — OpenAI
 *   bun deploy-tts-endpoint.ts --backend edge          # TTS only — edge-tts (no API key)
 *   bun deploy-tts-endpoint.ts --deploy-all            # TTS + /api/zo-ask (recommended)
 *   bun deploy-tts-endpoint.ts --deploy-all --backend openai
 *   bun deploy-tts-endpoint.ts --host myhandle.zo.space
 *
 * One-time prerequisites:
 *   1. ZO_CLIENT_IDENTITY_TOKEN available (auto on Zo server)
 *   2. ZO_ASK_TOKEN in Zo Secrets  — create at Settings > Advanced > Access Tokens,
 *                                    then add as secret named ZO_ASK_TOKEN
 *   3. TTS secret in Zo Secrets:
 *        ElevenLabs: ELEVENLABS_API_KEY
 *        OpenAI:     OPENAI_API_KEY
 *        edge-tts:   none (run setup-edge-tts.sh first)
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

function flagValue(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

const deployAll = args.includes("--deploy-all");
const backend   = (flagValue("--backend") ?? "elevenlabs").toLowerCase();
const rawHost   = flagValue("--host") ?? "marlandoj.zo.space";
const ZO_HANDLE = rawHost.replace(".zo.space", "");
const ZO_SPACE_HOST = `https://${ZO_HANDLE}.zo.space`;

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
  console.error("❌  ZO_CLIENT_IDENTITY_TOKEN not set. Run this script on your Zo server.");
  process.exit(1);
}

async function deployRoute(label: string, path: string, code: string): Promise<void> {
  console.log(`📡  Deploying ${path} [${label}] …`);

  const res = await fetch("https://api.zo.computer/zo/ask", {
    method: "POST",
    headers: {
      Authorization: IDENTITY_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [
        `Create (or overwrite) a zo.space API route at path \`${path}\` with route_type=api and public=true.`,
        "Use EXACTLY the following TypeScript code, no changes:",
        "```typescript",
        code,
        "```",
        "After creating the route call get_space_errors() to confirm no runtime errors.",
        "Reply with only: OK or ERROR:<reason>",
      ].join("\n"),
      model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
    }),
  });

  if (!res.ok) {
    throw new Error(`Zo API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as { output: string };
  const output = (data.output ?? "").trim();

  if (output.startsWith("ERROR")) {
    throw new Error(`Deploy failed: ${output}`);
  }

  console.log(`✅  ${path} → ${ZO_SPACE_HOST}${path}`);
}

// ─── Deploy TTS route ─────────────────────────────────────────────────────────
const ttsCode = readFileSync(join(__dirname, "../assets", cfg.file), "utf8");

if (cfg.secret) {
  console.log(`    TTS requires secret: ${cfg.secret} (Settings > Advanced)`);
}

try {
  await deployRoute(backend, "/api/tts", ttsCode);
} catch (err) {
  console.error("❌ ", err);
  process.exit(1);
}

// ─── Deploy zo-ask route (--deploy-all) ───────────────────────────────────────
if (deployAll) {
  const askCode = readFileSync(join(__dirname, "../assets/zo-ask-route.ts"), "utf8");
  console.log("    zo-ask requires secret: ZO_ASK_TOKEN (Settings > Advanced > Access Tokens → Secrets)");

  try {
    await deployRoute("zo-ask", "/api/zo-ask", askCode);
  } catch (err) {
    console.error("❌ ", err);
    process.exit(1);
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("");
console.log("Setup complete. Configure the PWA with:");
console.log(`  Zo Space Host: ${ZO_SPACE_HOST}`);
console.log("");
console.log("Required Zo Secrets (Settings > Advanced):");
if (cfg.secret) console.log(`  ${cfg.secret}       — TTS API key`);
if (deployAll)  console.log(`  ZO_ASK_TOKEN         — Zo access token for the AI proxy`);
if (!cfg.secret) console.log("  (none for edge-tts — run setup-edge-tts.sh once)");
