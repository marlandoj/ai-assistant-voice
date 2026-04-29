#!/usr/bin/env bun
/**
 * Deploy a /api/tts zo.space proxy route.
 *
 * Usage:
 *   bun deploy-tts-endpoint.ts                        # ElevenLabs (default, recommended)
 *   bun deploy-tts-endpoint.ts --backend openai       # OpenAI TTS
 *   bun deploy-tts-endpoint.ts --backend edge         # edge-tts (no API key)
 *   bun deploy-tts-endpoint.ts --host myhandle.zo.space
 *
 * Prerequisites:
 *   - ZO_CLIENT_IDENTITY_TOKEN env var (auto-available on Zo server)
 *   - Backend secret saved in Zo Secrets (Settings > Advanced):
 *       ElevenLabs: ELEVENLABS_API_KEY
 *       OpenAI:     OPENAI_API_KEY
 *       edge-tts:   none (run setup-edge-tts.sh first)
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

const backend = (flagValue("--backend") ?? "elevenlabs").toLowerCase();
const rawHost = flagValue("--host") ?? "marlandoj.zo.space";
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

const routeCode = readFileSync(join(__dirname, "../assets", cfg.file), "utf8");

console.log(`📡  Deploying /api/tts [${backend}] to ${ZO_SPACE_HOST} …`);
if (cfg.secret) {
  console.log(`    Requires secret: ${cfg.secret} (Settings > Advanced)`);
}

const res = await fetch("https://api.zo.computer/zo/ask", {
  method: "POST",
  headers: {
    Authorization: IDENTITY_TOKEN,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    input: [
      "Create (or overwrite) a zo.space API route at path `/api/tts` with route_type=api and public=true.",
      "Use EXACTLY the following TypeScript code, no changes:",
      "```typescript",
      routeCode,
      "```",
      "After creating the route call get_space_errors() to confirm no runtime errors.",
      "Reply with only: OK or ERROR:<reason>",
    ].join("\n"),
    model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
  }),
});

if (!res.ok) {
  console.error(`❌  Zo API error: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const data = await res.json() as { output: string };
const output = (data.output ?? "").trim();

if (output.startsWith("ERROR")) {
  console.error("❌  Deploy failed:", output);
  process.exit(1);
}

console.log(`✅  /api/tts deployed → ${ZO_SPACE_HOST}/api/tts`);
console.log("");
console.log("Next steps:");
if (cfg.secret) {
  console.log(`  1. Ensure ${cfg.secret} is saved in Zo Secrets (Settings > Advanced)`);
  console.log(`  2. Set the TTS endpoint in the PWA settings to: ${ZO_SPACE_HOST}/api/tts`);
} else {
  console.log(`  1. Run setup-edge-tts.sh once to install the edge-tts Python package`);
  console.log(`  2. Set the TTS endpoint in the PWA settings to: ${ZO_SPACE_HOST}/api/tts`);
  console.log(`  3. Voice IDs are edge-tts voice names, e.g. en-US-GuyNeural`);
}
