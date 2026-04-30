# AI Assistant Voice

A voice interface for [Zo Computer](https://zo.computer) that lets you speak to any AI persona and hear its responses read back aloud. Built as a Progressive Web App (PWA) — it works in your browser, installs to your phone's home screen, and keeps all API keys safely on the server side.

Works with **any persona** you've configured on your Zo Computer — just enter the persona ID and a display name in the settings panel.

---

## How it works

1. You speak (or type) a message
2. Your words are sent to a server-side proxy on your `zo.space`, which forwards the request to your chosen AI persona
3. The response is read aloud using a text-to-speech engine of your choice
4. The conversation history stays on screen for reference

The TTS audio is generated server-side — your API keys never touch the browser.

---

## What's included

```
Skills/ai-assistant-voice/
├── pwa/                             # The voice interface (browser app)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.json                # PWA manifest (installable to home screen)
│   └── sw.js                        # Service worker (offline support, path-agnostic)
├── scripts/
│   ├── deploy-tts-endpoint.ts       # Deploy the TTS + AI proxy routes to zo.space
│   ├── ai-assistant-voice.ts        # CLI: manage voice configs, test speech
│   └── setup-edge-tts.sh            # One-time install for free edge-tts backend
└── assets/
    ├── tts-route.ts                 # ElevenLabs backend (recommended)
    ├── tts-route-openai.ts          # OpenAI TTS backend
    ├── tts-route-edge.ts            # edge-tts backend (no API key needed)
    └── zo-ask-route.ts              # Zo AI proxy (server-side token, no browser exposure)
```

---

## Requirements

- A [Zo Computer](https://zo.computer) account
- A Zo API access token saved as `ZO_ASK_TOKEN` in Zo Secrets (Settings → Advanced)
- A TTS API key — or use the free `edge-tts` backend (no key required)
- [Bun](https://bun.sh) runtime (pre-installed on Zo)

---

## Installation

### Step 1 — Clone the repo

**Via terminal:**
```bash
git clone https://github.com/marlandoj/ai-assistant-voice.git \
  /home/workspace/Skills/ai-assistant-voice
```

**Via natural language** (on your Zo Computer):
> "Install the ai-assistant-voice skill from GitHub and set it up."

---

### Step 2 — Set your Zo API token server-side

The PWA never touches credentials directly — all AI calls are proxied through your `zo.space`. Store your token once:

**In plain language:** Go to Settings → Advanced on your Zo Computer:
1. Under **Access Tokens** — create a new token and copy it
2. Under **Secrets** — add a secret named `ZO_ASK_TOKEN` with that token as the value

---

### Step 3 — Choose a TTS backend and deploy the proxy

The voice interface needs a server-side TTS proxy. Pick the backend that works for you:

#### Option A — ElevenLabs ⭐ Recommended

Best voice quality. Natural, expressive output.

**In plain language:** Go to Settings → Advanced → Secrets, add `ELEVENLABS_API_KEY` with your key from [elevenlabs.io](https://elevenlabs.io). Then run:

```bash
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts --deploy-all
```

---

#### Option B — OpenAI TTS

Very good quality. Six voices. Most users already have an OpenAI key.

**In plain language:** Add `OPENAI_API_KEY` to your Zo Secrets, then run:

```bash
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts --backend openai --deploy-all
```

Available voices: `alloy`, `echo`, `fable`, `onyx` (default), `nova`, `shimmer`

---

#### Option C — edge-tts (free, no API key)

Uses Microsoft Edge's neural voices. 300+ voices, completely free, no account needed.

```bash
bash /home/workspace/Skills/ai-assistant-voice/scripts/setup-edge-tts.sh
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts --backend edge --deploy-all
```

Browse voices: `edge-tts --list-voices | grep "en-US"`

---

#### Option D — No backend (browser fallback)

Skip this step — the PWA automatically falls back to your browser's built-in speech synthesis. No setup required. Quality varies by device.

---

### Step 4 — Open the PWA

Open `pwa/index.html` in your browser, or deploy the `pwa/` directory to any static host or zo.space route.

On first launch, tap the ⚙️ settings icon to configure:
- **Zo Space Host** — your `yourhandle.zo.space` URL
- **Persona** — which AI persona to talk to (enter the persona ID from Settings → AI → Personas)
- **Assistant Name** — display name shown in the chat (e.g. "Alaric", "Nova", "Max")
- **Voice** — which TTS voice to use

No API keys or tokens are entered in the browser — everything is handled server-side.

---

### Step 5 — Install to your phone (optional)

Open the PWA in Chrome or Safari on your phone, then use "Add to Home Screen." It launches full-screen with no browser UI, like a native app.

---

## Finding your persona ID

1. Go to [Settings → AI → Personas](/?t=settings&s=ai&d=personas) on your Zo Computer
2. Click on the persona you want to use
3. Copy the ID from the URL or persona detail panel

---

## CLI usage

The CLI manages voice configs and lets you test TTS from the terminal:

```bash
cd /home/workspace/Skills/ai-assistant-voice/scripts

# List available ElevenLabs voices
bun ai-assistant-voice.ts voices

# Save a persona → voice mapping
bun ai-assistant-voice.ts config set \
  --persona <your-persona-id> \
  --name "My Assistant" \
  --voice ErXwobaYiN019PkySvjV

# View saved mappings
bun ai-assistant-voice.ts config list

# Test speech output
bun ai-assistant-voice.ts speak "Hello, how can I help?" --voice ErXwobaYiN019PkySvjV
```

Voice configs are stored at `~/.zo/voice/persona-voices.json`.

---

## TTS backend comparison

| Backend | Voice quality | Cost | API key required |
|---|---|---|---|
| ⭐ ElevenLabs | Best — natural, expressive | ~$0.30 / 1K chars | `ELEVENLABS_API_KEY` |
| OpenAI TTS | Very good — 6 voices | ~$0.015 / 1K chars | `OPENAI_API_KEY` |
| edge-tts | Good — 300+ neural voices | Free | None |
| Browser Speech | Basic | Free | None |

---

## Customizing the TTS route

The route source files are in `assets/`. Edit the one you're using, then re-run the deploy script:

```bash
# Edit assets/tts-route.ts, then:
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts
```

---

## Deploying to a different zo.space host

```bash
bun /home/workspace/Skills/ai-assistant-voice/scripts/deploy-tts-endpoint.ts \
  --backend elevenlabs --host yourhandle.zo.space
```

---

## License

MIT
