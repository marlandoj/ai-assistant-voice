---
name: ai-assistant-voice
description: >
  Full-screen voice AI PWA for any Zo persona with a multi-model hybrid architecture.
  GPT-Realtime-2 handles audio (speech→speech). Alaric personality runs via Zo Computer
  backend with full memory, skills, and tool access. Three-model pipeline: Audio (Realtime-2)
  → Personality (session.update) → Tools (Zo API via orchestrator). Includes one-command
  installer for zo.space routes. Three TTS backends. Falls back to browser Web Speech API.
compatibility: Created for Zo Computer
metadata:
  author: marlandoj.zo.computer
  version: 2.2.0
  requires:
    - ZO_ASK_TOKEN (required — Zo Access Token for AI proxy + orchestrator, Settings > Advanced)
    - ELEVENLABS_API_KEY (optional — for ElevenLabs TTS backend)
    - OPENAI_API_KEY (optional — for OpenAI TTS backend + Realtime mode)
---

# AI Assistant Voice

Full-screen voice AI PWA — works with any persona on your Zo Computer.

## Architecture

This skill implements a **multi-model hybrid pipeline**:

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  BROWSER    │◄───►│ GPT-Realtime-2  │◄───►│  Zo Computer    │
│  (WebRTC)   │     │  (Audio brain)  │     │ (Memory/Tools)  │
└─────────────┘     └─────────────────┘     └─────────────────┘
       │                    │                       │
       │  Speech in         │  session.update       │  zo_ask tool call
       │  Audio out         │  instructions + tools │  → /api/alaric-orchestrator
       │                    │  turn_detection       │  → Zo /zo/ask API
       │                    │                       │
       ▼                    ▼                       ▼
   Realtime GA API     Data channel config      Alaric persona
   v1/realtime/calls   (post-connection)        + full skill access
```

| Layer | Model/Path | Purpose |
|---|---|---|
| **Audio** | `gpt-realtime-2` via WebRTC | Native speech→speech, ~300ms latency |
| **Personality** | `session.update` over data channel | Alaric J.A.R.V.I.S. instructions injected after connect |
| **Tools** | `zo_ask` → `/api/alaric-orchestrator` | Memory, skills, workspace access through Zo API |
| **Brain** | Full Alaric persona (`/zo/ask`) | Persistent memory, file access, automation |

**Why three models?** GPT-Realtime-2 is audio-native but has no Zo memory or skill access. By injecting Alaric's personality via `session.update` and wiring a `zo_ask` tool, we get the best of both worlds: the speed and naturalness of Realtime audio with the loyalty and capability of the Zo backend.

---

## Quick Install (recommended)

One command deploys everything: the PWA page + all four API routes.

```bash
# 1. Save ZO_ASK_TOKEN + OPENAI_API_KEY in Settings > Advanced first
# 2. Run:
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts \
  --deploy-all \
  --name "Alaric" \
  --path "/alaric-voice" \
  --persona-id "9fa5bf37-8fdb-4172-80f0-1bc48eda8911"
```

This deploys:
- `/alaric-voice` — the voice PWA page (private, owner sign-in required)
- `/api/tts` — TTS proxy (keeps ElevenLabs key server-side)
- `/api/ai-ask` — Zo ask proxy (keeps ZO_ASK_TOKEN server-side)
- `/api/realtime-session` — OpenAI Realtime GA API ephemeral token endpoint
- `/api/alaric-orchestrator` — (v2.2+) Zo tool-call mediator for Realtime mode

After deploying, open `https://yourhandle.zo.space/alaric-voice`.

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
| `ZO_ASK_TOKEN` | ✅ Yes | Zo access token — create at Settings > Advanced > Access Tokens, then add as a Secret. Used by both `/api/ai-ask` and `/api/alaric-orchestrator`. |
| `OPENAI_API_KEY` | For Realtime mode | GPT-Realtime-2 GA API token minting |
| `ELEVENLABS_API_KEY` | If using ElevenLabs TTS | From elevenlabs.io → Profile → API Keys |

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

## Realtime Mode (Hybrid)

Realtime mode uses **GPT-Realtime-2** via the GA API for native speech-to-speech, but with Alaric's full Zo backend wired in.

### How it works

1. **Connect** → Browser requests ephemeral token from `/api/realtime-session` via `/v1/realtime/client_secrets`
2. **WebRTC** → Browser exchanges SDP with `api.openai.com/v1/realtime/calls`
3. **Inject personality** → Browser sends `session.update` over data channel with Alaric instructions + `zo_ask` tool schema
4. **Listen & respond** → User speaks; GPT-Realtime-2 responds. If a tool is needed, it calls `zo_ask` with a natural language query
5. **Delegate to Zo** → PWA forwards tool call to `/api/alaric-orchestrator`, which calls Zo `/zo/ask` with Alaric persona
6. **Return result** → Orchestrator result fed back into Realtime as `function_call_output`; GPT-Realtime-2 speaks the answer aloud

### Event flow

```
[input_audio_buffer.speech_started]     → isRecording = true
[input_audio_buffer.speech_stopped]     → isRecording = false
[session.updated]                       → confirm personality + tools loaded
[response.function_call_arguments.done] → trigger zo_ask → /api/alaric-orchestrator
[conversation.item.create]              → inject function_call_output
[response.create]                       → GPT-Realtime-2 speaks the result
```

---

## GPT-Realtime GA API Migration (v2.2)

As of May 2026, GPT-Realtime-2 moved to **General Availability (GA)**. The API surface changed:

| | Old (Beta) | New (GA) |
|---|---|---|
| Token mint | `POST /v1/realtime/sessions` | `POST /v1/realtime/client_secrets` |
| Token response | `{ client_secret: { value } }` | `{ value }` |
| Connect | `POST /v1/realtime?model=` | `POST /v1/realtime/calls?model=` |
| Config | Sent at token mint time | Sent via data channel `session.update` |
| Model param at mint | Accepted (now rejected) | **Rejected** — bare `POST {}` only |

**Important:** `client_secrets` does **not** accept `model`, `instructions`, `tools`, or `voice` — it only mints a raw ephemeral token. All configuration must be pushed through the WebRTC data channel after connection.

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
- **Realtime Mode (Hybrid)**: GPT-Realtime-2 audio + Alaric personality + Zo tool access via orchestrator
- Tool delegation: GPT-Realtime-2 can invoke `zo_ask` for any task requiring memory, files, or skills
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

---

## Troubleshooting

| Symptom | Root Cause | Fix |
|---|---|---|
| `"Unknown parameter: 'model'"` | Sending `model` in `/client_secrets` body | Bare `POST {}` — move all config to data channel `session.update` |
| "Session updated but no personality" | `session.update` format wrong or no `.done` handler | Check DevTools console for `session.updated` event — log shows `tools: [...]` |
| "Realtime says things but doesn't use tools" | `create_response: false` in `turn_detection` | Set `create_response: true` |
| "Tool detected but hangs" | Missing `function_call_output` → `response.create` chain | Verify orchestrator returns JSON with `result` field, then PWA injects output and triggers new response |
| "No ephemeral token" | Token field path mismatch (old `client_secret.value`) | GA uses `session.value` directly |

---

## Historical Notes

- **v2.1.0**: Single-model Realtime with `gpt-4o-mini-realtime-preview` via `/v1/realtime/sessions`. Tools and personality pre-configured at token mint time.
- **v2.2.0**: Multi-model hybrid with `gpt-realtime-2` GA API. Personality + tools injected via data channel. Orchestrator route added for Zo delegation. `client_secrets` + `/realtime/calls` endpoints adopted.
