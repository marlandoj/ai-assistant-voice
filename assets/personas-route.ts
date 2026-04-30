import type { Context } from "hono";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { personas: { id: string; name: string }[]; ts: number } | null = null;

export default async (c: Context) => {
  if (cache && Date.now() - cache.ts < CACHE_TTL_MS) {
    return c.json({ personas: cache.personas });
  }

  const token = process.env.ZO_ASK_TOKEN;
  if (!token) return c.json({ error: "ZO_ASK_TOKEN not set" }, 503);

  try {
    const res = await fetch("https://api.zo.computer/zo/ask", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        input: "List all personas. Return ONLY a JSON array of objects with id and name fields, no markdown, no explanation. Example: [{\"id\":\"uuid\",\"name\":\"Persona Name\"}]",
        model_name: "byok:63a73cf2-224a-4641-8dcb-c3313270d08a",
        output_format: {
          type: "object",
          properties: {
            personas: {
              type: "array",
              items: {
                type: "object",
                properties: { id: { type: "string" }, name: { type: "string" } },
                required: ["id", "name"],
              },
            },
          },
          required: ["personas"],
        },
      }),
    });

    if (!res.ok) throw new Error(`Zo API ${res.status}`);
    const data = await res.json() as { output: { personas: { id: string; name: string }[] } };
    const personas = data.output?.personas ?? [];
    cache = { personas, ts: Date.now() };
    return c.json({ personas });
  } catch (err) {
    console.error("[personas] fetch error:", err);
    return c.json({ personas: cache?.personas ?? [], error: String(err) }, 207);
  }
};
