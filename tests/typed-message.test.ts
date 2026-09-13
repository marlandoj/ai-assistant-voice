import { expect, test } from "bun:test";
import handler from "../assets/ai-ask-route.ts";
import eleven from "../assets/tts-route.ts";
import openai from "../assets/tts-route-openai.ts";
import edge from "../assets/tts-route-edge.ts";

for (const [name, route] of [["text", handler], ["ElevenLabs", eleven], ["OpenAI", openai], ["Edge", edge]] as const) test(`${name} preflight permits every header sent by the private page`, async () => {
  const origin = "https://zite-3099-example.zo.computer";
  const response = await route({ req: { method: "OPTIONS", header: (name: string) => name === "origin" ? origin : undefined } } as any);
  expect(response.status).toBe(204);
  expect(response.headers.get("Access-Control-Allow-Origin")).toBe(origin);
  const allowed = response.headers.get("Access-Control-Allow-Headers")!.toLowerCase().split(",").map(v => v.trim());
  expect(allowed).toContain("content-type");
  expect(allowed).toContain("x-{{assistant_name}}-auth");
  expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
});
