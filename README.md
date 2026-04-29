# Persona Voice

A voice interface for [Zo Computer](https://zo.computer) that lets you speak to any AI persona and hear its responses read back aloud. Built as a Progressive Web App (PWA) — it works in your browser, installs to your phone's home screen, and keeps all API keys safely on the server side.

Originally built for Alaric, the J.A.R.V.I.S.-inspired Zo persona, but designed to work with any persona you've configured on your Zo.

---

## How it works

1. You speak (or type) a message
2. Your words are sent to the Zo AI API, routed to whichever persona you've selected
3. The response is read aloud using a text-to-speech engine of your choice
4. The conversation history stays on screen for reference

The TTS audio is generated server-side through a proxy route on your `zo.space` — your API keys never touch the browser.

---

## What's included

```
Skills/persona-voice/
├── pwa/                        # The voice interface (browser app)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── manifest.json           # PWA manifest (installable)
│   └── sw.js                   # Service worker (offline support)
├── scripts/
│   ├── deploy-tts-endpoint.ts  # Deploy the TTS proxy to zo.space
│   ├── persona-voice.ts        # CLI: manage voices, test speech
│   └── setup-edge-tts.sh       # One-time install for free edge-tts backend
└── assets/
    ├── tts-route.ts            # ElevenLabs backend (recommended)
    ├── tts-route-openai.ts     # OpenAI TTS backend
    ├── tts-route-edge.ts       # edge-tts backend (no API key needed)
    └── zo-ask-route.ts         # Zo AI proxy (server-side token, no browser exposure)
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

```bash
git clone https://github.com/marlandoj/persona-voice.git \
  /home/workspace/Skills/persona-voice
```

Or if you're already on Zo and this is in your Skills directory, skip this step.

---

### Step 2 — Choose a TTS backend and deploy the proxy

The voice interface needs a server-side TTS proxy. Pick the backend that works for you:

#### Option A — ElevenLabs ⭐ Recommended

Best voice quality. Natural, expressive output. Requires an ElevenLabs API key.

**In plain language:** Go to your Zo Settings → Advanced → Secrets, add a secret named `ELEVENLABS_API_KEY` with your key from [elevenlabs.io](https://elevenlabs.io). Then run:

```bash
bun /home/workspace/Skills/persona-voice/scripts/deploy-tts-endpoint.ts
```

---

#### Option B — OpenAI TTS

Very good quality. Six voices. Most users already have an OpenAI key.

**In plain language:** Add `OPENAI_API_KEY` to your Zo Secrets (Settings → Advanced), then run:

```bash
bun /home/workspace/Skills/persona-voice/scripts/deploy-tts-endpoint.ts --backend openai
```

Available voices: `alloy`, `echo`, `fable`, `onyx` (default), `nova`, `shimmer`

---

#### Option C — edge-tts (free, no API key)

Uses Microsoft Edge's neural voices. 300+ voices, completely free, no account needed.

**In plain language:** Run the setup script once to install the tool, then deploy:

```bash
bash /home/workspace/Skills/persona-voice/scripts/setup-edge-tts.sh
bun /home/workspace/Skills/persona-voice/scripts/deploy-tts-endpoint.ts --backend edge
```

To browse available voices:
```bash
edge-tts --list-voices | grep "en-US"
```

---

#### Option D — No backend (browser fallback)

If you skip this step entirely, the PWA will use your browser's built-in speech synthesis automatically. Quality varies by device. No setup required.

---

### Step 3 — Set your Zo API token server-side

The PWA never touches credentials directly — all API calls are proxied through your `zo.space`. You need to store your Zo token as a server-side secret once:

**In plain language:** Go to Settings → Advanced on your Zo Computer:
1. Under **Access Tokens** — create a new token and copy it
2. Under **Secrets** — add a secret named `ZO_ASK_TOKEN` with that token as the value

The zo.space server will pick it up automatically on the next restart.

---

### Step 4 — Open the PWA

Open `pwa/index.html` in your browser, or serve the `pwa/` directory from any static host.

On first launch, tap the ⚙️ settings icon to configure:
- **Persona** — which AI persona to talk to (e.g. Alaric, Alaric · Fast)
- **Voice** — which ElevenLabs voice to use (falls back to browser speech if unavailable)

No API keys or tokens are entered in the browser — everything is handled server-side.

---

### Step 5 — Install to your phone (optional)

Open the PWA in Chrome or Safari on your phone, then use "Add to Home Screen." It launches full-screen with no browser UI, like a native app.

---

## CLI usage

The CLI manages voice configs and lets you test TTS from the terminal:

```bash
cd /home/workspace/Skills/persona-voice/scripts

# List available ElevenLabs voices
bun persona-voice.ts voices

# Save a persona → voice mapping
bun persona-voice.ts config set \
  --persona fe5d7648-140a-4277-a7d4-7d8d7bf4aee8 \
  --name "Alaric" \
  --voice ErXwobaYiN019PkySvjV

# View saved mappings
bun persona-voice.ts config list

# Test speech output
bun persona-voice.ts speak "Good afternoon, Sir." --voice ErXwobaYiN019PkySvjV
```

Voice configs are stored at `~/.zo/voice/persona-voices.json`.

---

## TTS backend comparison

| Backend | Voice quality | Cost | API key |
|---|---|---|---|
| ⭐ ElevenLabs | Best | ~$0.30 / 1K chars | `ELEVENLABS_API_KEY` |
| OpenAI TTS | Very good | ~$0.015 / 1K chars | `OPENAI_API_KEY` |
| edge-tts | Good | Free | None |
| Browser Speech | Basic | Free | None |

---

## Customizing the TTS route

The route source files are in `assets/`. Edit the one you're using, then re-run the deploy script to push the changes to zo.space:

```bash
# Edit assets/tts-route.ts, then:
bun /home/workspace/Skills/persona-voice/scripts/deploy-tts-endpoint.ts
```

---

## Deploying to a different zo.space host

```bash
bun deploy-tts-endpoint.ts --backend elevenlabs --host yourhandle.zo.space
```

---

## License

MIT
