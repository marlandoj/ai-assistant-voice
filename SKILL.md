---
name: persona-voice
description: >
  Generic voice interface PWA that works with any Zo persona. Speech → Zo API → ElevenLabs TTS.
  Persona-agnostic: configure any persona ID and assistant name at runtime. Includes a CLI for
  managing voice configs and a full-screen PWA for mobile/desktop voice sessions.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  version: 1.0.0
  requires:
    - ELEVENLABS_API_KEY (set in Settings > Advanced — for TTS)
    - Zo API Access Token (entered in PWA settings)
---

# Persona Voice

Generic voice interface PWA — works with any Zo persona, not just Alaric.

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
bun /home/workspace/Skills/persona-voice/scripts/deploy-tts-endpoint.ts
# or explicitly:
bun deploy-tts-endpoint.ts --backend elevenlabs
```

Default voice: Antoni (`ErXwobaYiN019PkySvjV`). Use `scripts/persona-voice.ts voices` to list alternatives.

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
bash /home/workspace/Skills/persona-voice/scripts/setup-edge-tts.sh

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
cd /home/workspace/Skills/persona-voice/scripts

# List available ElevenLabs voices
bun persona-voice.ts voices

# Save a persona voice config
bun persona-voice.ts config set \
  --persona fe5d7648-140a-4277-a7d4-7d8d7bf4aee8 \
  --name "Alaric" \
  --voice ErXwobaYiN019PkySvjV

# List saved configs
bun persona-voice.ts config list

# Speak text
bun persona-voice.ts speak "Hello, Sir." --voice ErXwobaYiN019PkySvjV
```

## PWA

Deploy `pwa/` to any static host or zo.space asset. The PWA:
- Works as a standalone full-screen mobile app (add to Home Screen)
- Configures persona ID, assistant name, and voice per user in Settings
- Falls back to browser Web Speech API if ElevenLabs is unavailable

## Voice Config File

Configs are saved to `~/.zo/voice/persona-voices.json`:
```json
{
  "personas": [
    { "id": "fe5d7648-...", "name": "Alaric", "voiceId": "ErXwobaYiN019PkySvjV" }
  ]
}
```
