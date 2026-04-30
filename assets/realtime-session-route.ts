import type { Context } from "hono";

export default async (c: Context) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return c.json({ error: "OPENAI_API_KEY not configured in Zo Secrets" }, 503);

  const resp = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-realtime-preview",
      modalities: ["text"],
      input_audio_transcription: { model: "whisper-1" },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
        create_response: false,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return c.json({ error: `OpenAI error: ${text}` }, resp.status as 400 | 401 | 403 | 500);
  }

  return c.json(await resp.json());
};
