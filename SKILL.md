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
3. Deploy the PWA or open `pwa/index.html` locally

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
