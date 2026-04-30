import type { Context } from "hono";

/**
 * Static personas list — update this when personas are added/removed on your Zo Computer.
 * To refresh: ask Zo to "update the personas list in the ai-assistant-voice skill".
 */
const PERSONAS: { id: string; name: string }[] = [
  // Replace this list with your own personas from Settings → AI → Personas
  // Format: { id: "your-persona-uuid", name: "Display Name" }
];

export default (c: Context) => c.json({ personas: PERSONAS });
