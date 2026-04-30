---
name: ai-assistant-voice
description: >
  Full-screen voice AI PWA for any Zo persona. Speech → Zo API proxy → AI response → TTS.
  Works with any persona on your Zo Computer — configure the persona ID, assistant name, and
  voice at runtime. Includes a CLI for managing voice configs and a deploy script for zo.space.
  Three TTS backends: ElevenLabs (recommended), OpenAI TTS, or edge-tts (free/no key).
  Falls back to browser Web Speech API automatically.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  version: 2.0.0
  requires:
    - ZO_ASK_TOKEN (required — Zo Access Token for AI proxy, Settings > Advanced)
    - ELEVENLABS_API_KEY (optional — for ElevenLabs TTS backend)
    - OPENAI_API_KEY (optional — for OpenAI TTS backend)
---

# AI Assistant Voice

Full-screen voice AI PWA — works with any persona on your Zo Computer.

## Setup

1. Set `ELEVENLABS_API_KEY` in [Settings → Advanced → Secrets](/?t=settings&s=advanced)
2. Get a Zo API token from [Settings → Advanced → Access Tokens](/?t=settings&s=advanced)
3. Deploy the TTS proxy endpoint to zo.space (see below)
4. Deploy the PWA or open `pwa/index.html` locally

## TTS Endpoint (zo.space proxy)

The PWA calls a server-side TTS proxy at `/api/tts` on zo.space — this keeps API keys
out of the browser. Three backend options are included:

| Backend | Quality | Cost | Secret required |
|---|---|---|---|
| ⭐ **ElevenLabs** *(recommended)* | Best — natural, expressive | ~$0.30/1K chars | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | Very good — 6 voices | ~$0.015/1K chars | `OPENAI_API_KEY` |
| **edge-tts** | Good — 300+ Neural voices | Free forever | None |

If no TTS endpoint is configured, the PWA falls back to the **browser's built-in Web Speech API** automatically.

---

### Deploy — ElevenLabs (recommended)

```bash
# Save ELEVENLABS_API_KEY in Settings > Advanced first
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts
# or explicitly:
bun deploy-tts-endpoint.ts --backend elevenlabs
```

Default voice: Antoni (`ErXwobaYiN019PkySvjV`). Use `scripts/ai-assistant-voice.ts voices` to list alternatives.

---

### Deploy — OpenAI TTS

```bash
# Save OPENAI_API_KEY in Settings > Advanced first
bun deploy-tts-endpoint.ts --backend openai
```

Voice IDs: `alloy` · `echo` · `fable` · `onyx` *(default)* · `nova` · `shimmer`

---

### Deploy — edge-tts (no API key)

```bash
# One-time install
bash /home/workspace/Skills/ai-assistant-voice/scripts/setup-edge-tts.sh

# Deploy
bun deploy-tts-endpoint.ts --backend edge
```

Voice IDs are edge-tts names, e.g. `en-US-GuyNeural`, `en-US-AriaNeural`.
Run `edge-tts --list-voices` to see all 300+ options.

---

### Custom host

```bash
bun deploy-tts-endpoint.ts --backend elevenlabs --host myhandle.zo.space
```

Route source files live in `assets/` — edit before re-deploying to customize CORS,
default voice, or model settings.

### Endpoint contract (all backends)

```
POST /api/tts
Headers: Content-Type: application/json
         X-Zo-User-Token: <your-zo-access-token>
Body:    { "text": "Hello", "voice_id": "<backend-specific-id>" }
Returns: audio/mpeg stream
```

## CLI

```bash
cd /home/workspace/Skills/ai-assistant-voice/scripts

# List available ElevenLabs voices
bun ai-assistant-voice.ts voices

# Save a persona voice config
bun ai-assistant-voice.ts config set \
  --persona <your-persona-id> \
  --name "My Assistant" \
  --voice ErXwobaYiN019PkySvjV

# List saved configs
bun ai-assistant-voice.ts config list

# Speak text
bun ai-assistant-voice.ts speak "Hello." --voice ErXwobaYiN019PkySvjV
```

Find your persona ID at [Settings → AI → Personas](/?t=settings&s=ai&d=personas).

## PWA

Deploy `pwa/` to any static host or zo.space. The PWA:
- Works as a standalone full-screen mobile app (add to Home Screen)
- Configures persona ID, assistant name, and voice per user in Settings
- Falls back to browser Web Speech API if TTS is unavailable
- Deploys to any path — `sw.js` auto-detects its base path

## Voice Config File

Configs are saved to `~/.zo/voice/persona-voices.json`:
```json
{
  "personas": [
    { "id": "<your-persona-id>", "name": "My Assistant", "voiceId": "ErXwobaYiN019PkySvjV" }
  ]
}
```
