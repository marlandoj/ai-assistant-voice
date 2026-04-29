#!/usr/bin/env bun
/**
 * Deploy the /api/tts zo.space proxy route.
 *
 * Prerequisites:
 *   - ZO_CLIENT_IDENTITY_TOKEN env var (auto-available on Zo server)
 *   - ELEVENLABS_API_KEY saved in Zo Secrets (Settings > Advanced)
 *
 * Usage:
 *   bun deploy-tts-endpoint.ts [--host marlandoj.zo.space]
 *
 * The script reads assets/tts-route.ts, submits it to Zo's space API,
 * and prints the live endpoint URL on success.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const hostFlag = args.indexOf("--host");
const ZO_HANDLE = hostFlag >= 0 ? args[hostFlag + 1].replace(".zo.space", "") : "marlandoj";
const ZO_SPACE_HOST = `https://${ZO_HANDLE}.zo.space`;

const IDENTITY_TOKEN = process.env.ZO_CLIENT_IDENTITY_TOKEN;
if (!IDENTITY_TOKEN) {
  console.error("❌  ZO_CLIENT_IDENTITY_TOKEN not set. Run this script on your Zo server.");
  process.exit(1);
}

const routeCode = readFileSync(
  join(__dirname, "../assets/tts-route.ts"),
  "utf8",
);

console.log("📡  Deploying /api/tts to zo.space …");

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
console.log(`  1. Ensure ELEVENLABS_API_KEY is saved in Zo Secrets (Settings > Advanced)`);
console.log(`  2. Set the TTS endpoint in the PWA settings to: ${ZO_SPACE_HOST}/api/tts`);
console.log(`  3. The endpoint accepts: POST { text, voice_id } with X-Zo-User-Token header`);
