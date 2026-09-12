# GPT-Live voices

In Settings, select GPT-Live, choose a voice and speaking style, then Save Settings. Preferences are saved in this browser and applied when the next conversation starts. Saving only these preferences leaves an active call running. Changing mode or persona still ends it. Realtime persona voice mapping and Classic ElevenLabs choices are separate.

Marin remains the default. The selector also includes the 12 additional voices documented by OpenAI, grouped by language. Delivery choices are Natural, Calm and measured, Warm and friendly, and Brisk and clear; these are instruction guidance, not a replacement for voice identity.

## Approved custom catalog

Custom voices require OpenAI eligibility, consent and creation in the same authorized OpenAI project used by this application. The integration does not grant eligibility or import external provider voice IDs, weights or voice packs. Keep exact external-provider voices in Classic mode.

After approval, configure the server environment variable `VOICE_LIVE_CUSTOM_VOICES` as a JSON array of authorized entries:

```json
[{ "id": "voice_example", "name": "Alaric", "approved": true }]
```

Use actual OpenAI-created IDs. Names are limited to 80 characters and the catalog to 20 distinct entries. Only the operator can configure the server catalog; the browser cannot add IDs or assert approval. The authenticated `voices` action on the Live route returns the catalog. On create, the server validates membership and maps an approved custom entry to `audio.output.voice: { "id": "voice_example" }`. Removing a catalog entry rejects future sessions selecting it; an existing call retains its startup voice. A rejected selection never silently substitutes another voice.

No custom voices are provisioned by this change. No recording is uploaded or enrollment request sent. OpenAI acceptance and audio quality of a real custom voice require an eligible project and authorized recordings.

## Official references

- [Session configuration and voices](https://developers.openai.com/api/docs/guides/live-conversations)
- [Custom voice eligibility and recording requirements](https://developers.openai.com/api/docs/guides/custom-voices)
- [Sales](https://openai.com/contact-sales/)
- [Developer Community API feedback](https://community.openai.com/c/api/feedback/31)

A future feature request can ask for programmatic catalog discovery, licensed third-party catalog imports and voice switching during a session. This release implements only documented startup configuration.
