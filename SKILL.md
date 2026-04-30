---
name: ai-assistant-voice
description: >
  Full-screen voice AI PWA for any Zo persona. Speech → Zo API proxy → AI response → TTS.
  Works with any persona on your Zo Computer — configure the persona ID, assistant name, and
  voice at runtime. Includes a one-command full installer for zo.space (PWA page + all API routes).
  Three TTS backends: ElevenLabs (recommended), OpenAI TTS, or edge-tts (free/no key).
  Falls back to browser Web Speech API automatically. GPT Realtime hybrid mode supported.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  version: 2.1.0
  requires:
    - ZO_ASK_TOKEN (required — Zo Access Token for AI proxy, Settings > Advanced)
    - ELEVENLABS_API_KEY (optional — for ElevenLabs TTS backend)
    - OPENAI_API_KEY (optional — for OpenAI TTS backend + Realtime mode)
---

# AI Assistant Voice

Full-screen voice AI PWA — works with any persona on your Zo Computer.

## Quick Install (recommended)

One command deploys everything: the PWA page + all four API routes.

```bash
# 1. Save ZO_ASK_TOKEN + ELEVENLABS_API_KEY in Settings > Advanced first
# 2. Run:
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts \
  --deploy-all \
  --name "My Assistant" \
  --path "/ai-assistant-voice" \
  --persona-id "your-persona-uuid"
```

This deploys:
- `/ai-assistant-voice` — the voice PWA page (private, owner sign-in required)
- `/api/tts` — TTS proxy (keeps ElevenLabs key server-side)
- `/api/ai-ask` — Zo ask proxy (keeps ZO_ASK_TOKEN server-side)
- `/api/realtime-session` — OpenAI Realtime session token endpoint

After deploying, open `https://yourhandle.zo.space/ai-assistant-voice`.

### Options

| Flag | Default | Description |
|---|---|---|
| `--name "Aria"` | `My Assistant` | Assistant display name shown in UI |
| `--path "/aria"` | `/ai-assistant-voice` | URL path for the PWA page |
| `--persona-id <uuid>` | *(none)* | Pre-populate the persona selector |
| `--backend openai` | `elevenlabs` | TTS backend (elevenlabs/openai/edge) |
| `--host myhandle.zo.space` | Auto-detected | Override Zo Space hostname |

Find your persona ID at [Settings → AI → Personas](/?t=settings&s=ai&d=personas).

---

## Required Secrets

Add these in [Settings → Advanced → Secrets](/?t=settings&s=advanced):

| Secret | Required | Purpose |
|---|---|---|
| `ZO_ASK_TOKEN` | ✅ Yes | Zo access token — create at Settings > Advanced > Access Tokens, then add as a Secret |
| `ELEVENLABS_API_KEY` | If using ElevenLabs TTS | From elevenlabs.io → Profile → API Keys |
| `OPENAI_API_KEY` | If using OpenAI TTS or Realtime mode | From platform.openai.com |

---

## TTS Backends

| Backend | Quality | Cost | Secret |
|---|---|---|---|
| ⭐ **ElevenLabs** *(default)* | Best — natural, expressive | ~$0.30/1K chars | `ELEVENLABS_API_KEY` |
| **OpenAI TTS** | Very good — 6 voices | ~$0.015/1K chars | `OPENAI_API_KEY` |
| **edge-tts** | Good — 300+ Neural voices | Free forever | None |

### edge-tts (no API key)

```bash
bash /home/workspace/Skills/ai-assistant-voice/scripts/setup-edge-tts.sh
bun deploy-tts-endpoint.ts --deploy-all --backend edge
```

---

## TTS-Only Deploy

If you only need the TTS proxy (not the full PWA):

```bash
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts
```

---

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

---

## PWA Features

- Full-screen mobile-friendly UI with push-to-talk and hands-free modes
- Wake word activation ("Hey [name]") when tab is active
- Classic mode: Speech → Zo proxy → AI response → TTS (full context + memory)
- Realtime mode: GPT-4o-mini-realtime-preview via WebRTC for ~300ms latency
- Persona selector — switch between any of your Zo personas mid-session
- New session button — clear conversation history
- Falls back to browser Web Speech API if TTS is unavailable

## Voice Config File

Configs are saved to `~/.zo/voice/persona-voices.json`:
```json
{
  "personas": [
    { "id": "<your-persona-id>", "name": "My Assistant", "voiceId": "ErXwobaYiN019PkySvjV" }
  ]
}
```
