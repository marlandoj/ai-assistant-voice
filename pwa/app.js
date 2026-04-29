/**
 * persona-voice PWA — app.js
 * Generic voice interface for any Zo persona.
 * Speech → Zo API → response → ElevenLabs TTS → audio playback.
 * Falls back to browser Web Speech API if TTS unavailable.
 */

'use strict';

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE    = 'https://api.zo.computer';
const ASK_ENDPOINT = `${API_BASE}/zo/ask`;

// TTS endpoint — configurable in settings (defaults to Zo space proxy pattern)
const DEFAULT_TTS_HOST = '';  // empty = use browser TTS fallback until configured

// Built-in voice presets (ElevenLabs voice IDs)
const VOICE_PRESETS = {
  Antoni: 'ErXwobaYiN019PkySvjV',
  Rachel: '21m00Tcm4TlvDq8ikWAM',
  Bella:  'EXAVITQu4vr4xnSDxMaL',
  Grace:  'Yko7PKHZNXotIFUBG7I9',
};

// localStorage key prefix — namespaced to avoid collisions
const NS = 'pv_';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  apiKey:         localStorage.getItem(`${NS}api_key`)         || '',
  personaId:      localStorage.getItem(`${NS}persona_id`)      || '',
  assistantName:  localStorage.getItem(`${NS}assistant_name`)  || 'Assistant',
  voiceName:      localStorage.getItem(`${NS}voice_name`)      || 'Antoni',
  voiceId:        localStorage.getItem(`${NS}voice_id`)        || VOICE_PRESETS.Antoni,
  ttsEndpoint:    localStorage.getItem(`${NS}tts_endpoint`)    || '',
  conversationId: localStorage.getItem(`${NS}conversation_id`) || null,
  messages:       [],
  isRecording:    false,
  isSpeaking:     false,
  isTyping:       false,
  settingsOpen:   false,
  speechRec:      null,
};

// ─── DOM helpers ──────────────────────────────────────────────────────────────
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── Utilities ────────────────────────────────────────────────────────────────
function ts() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toast(msg, type = 'info', duration = 3000) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type} show`;
  setTimeout(() => { el.className = 'toast'; }, duration);
}

function avatarInitial() {
  return (state.assistantName || 'A')[0].toUpperCase();
}

function updateHeader() {
  const title = $('#assistant-title');
  const sub   = $('#assistant-subtitle');
  if (title) title.textContent = state.assistantName || 'Voice AI';
  if (sub)   sub.textContent   = 'AI Assistant';
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function loadSettings() {
  state.apiKey        = localStorage.getItem(`${NS}api_key`)         || '';
  state.personaId     = localStorage.getItem(`${NS}persona_id`)      || '';
  state.assistantName = localStorage.getItem(`${NS}assistant_name`)  || 'Assistant';
  state.voiceName     = localStorage.getItem(`${NS}voice_name`)      || 'Antoni';
  state.voiceId       = localStorage.getItem(`${NS}voice_id`)        || VOICE_PRESETS.Antoni;
  state.ttsEndpoint   = localStorage.getItem(`${NS}tts_endpoint`)    || '';
}

function openSettings() {
  const sheet = $('#settings-sheet');
  sheet.classList.add('open');
  $('#api-key-input').value       = state.apiKey;
  $('#persona-id-input').value    = state.personaId;
  $('#assistant-name-input').value = state.assistantName;
  $('#voice-select').value        = state.voiceName;
  $('#tts-endpoint-input').value  = state.ttsEndpoint;
  state.settingsOpen = true;
}

function closeSettings() {
  $('#settings-sheet').classList.remove('open');
  state.settingsOpen = false;
}

async function saveSettings() {
  const apiKey        = $('#api-key-input').value.trim();
  const personaId     = $('#persona-id-input').value.trim();
  const assistantName = $('#assistant-name-input').value.trim() || 'Assistant';
  const voiceName     = $('#voice-select').value;
  const ttsEndpoint   = $('#tts-endpoint-input').value.trim();

  if (!apiKey) {
    const msg = $('#status-msg');
    msg.textContent = '⚠️  Zo API key is required.';
    msg.className = 'status-msg error';
    return;
  }

  state.apiKey        = apiKey;
  state.personaId     = personaId;
  state.assistantName = assistantName;
  state.voiceName     = voiceName;
  state.voiceId       = VOICE_PRESETS[voiceName] || voiceName;
  state.ttsEndpoint   = ttsEndpoint;

  localStorage.setItem(`${NS}api_key`,        apiKey);
  localStorage.setItem(`${NS}persona_id`,     personaId);
  localStorage.setItem(`${NS}assistant_name`, assistantName);
  localStorage.setItem(`${NS}voice_name`,     voiceName);
  localStorage.setItem(`${NS}voice_id`,       state.voiceId);
  localStorage.setItem(`${NS}tts_endpoint`,   ttsEndpoint);

  updateHeader();

  const msg = $('#status-msg');
  msg.textContent = '✅ Settings saved.';
  msg.className = 'status-msg success';
  setTimeout(() => { closeSettings(); showConfigBanner(); }, 800);
}

// ─── Config banner ────────────────────────────────────────────────────────────
function showConfigBanner() {
  const banner = $('#config-banner');
  if (banner) banner.style.display = state.apiKey ? 'none' : '';
}

// ─── Conversation rendering ───────────────────────────────────────────────────
function scrollToBottom() {
  const el = $('#conversation');
  requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
}

function renderMessages() {
  const container = $('#conversation');
  if (state.messages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
        </div>
        <h3>Ready to listen</h3>
        <p>Tap the mic to speak, or type a message below.</p>
      </div>`;
    return;
  }

  container.innerHTML = state.messages.map((m) => {
    const role   = m.role === 'user' ? 'user' : m.role === 'system' ? 'system' : 'alaric';
    const avatar =
      role === 'user'   ? `<div class="avatar user-avatar">${m.name ? m.name[0] : 'U'}</div>` :
      role === 'system' ? `<div class="avatar system-avatar">⚡</div>` :
                          `<div class="avatar alaric">${avatarInitial()}</div>`;
    return `
      <div class="message ${role}">
        ${avatar}
        <div class="bubble-wrap">
          <div class="bubble">${m.text}</div>
          <span class="timestamp">${m.time || ''}</span>
        </div>
      </div>`;
  }).join('');

  scrollToBottom();
}

function addMessage(role, text, name) {
  state.messages.push({ role, text, time: ts(), name: name || '' });
  renderMessages();
}

function setTyping(visible) {
  const container = $('#conversation');
  let el = $('#typing-indicator');
  if (visible) {
    if (!el) {
      container.insertAdjacentHTML('beforeend', `
        <div class="typing-wrap" id="typing-indicator">
          <div class="avatar alaric" style="flex-shrink:0">${avatarInitial()}</div>
          <div class="typing-bubble">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>`);
    }
  } else {
    if (el) el.remove();
  }
  state.isTyping = visible;
  scrollToBottom();
}

// ─── TTS ──────────────────────────────────────────────────────────────────────
async function speakText(text) {
  if (!text || !state.apiKey || !state.ttsEndpoint) {
    if (!state.ttsEndpoint) await browserTTS(text);
    return;
  }

  state.isSpeaking = true;
  updateMicButton();

  try {
    const resp = await fetch(state.ttsEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, voice_id: state.voiceId }),
    });

    if (!resp.ok) throw new Error(`TTS ${resp.status}`);

    const blob  = await resp.blob();
    const url   = URL.createObjectURL(blob);
    const audio = new Audio(url);

    audio.onended = audio.onerror = () => {
      URL.revokeObjectURL(url);
      state.isSpeaking = false;
      updateMicButton();
    };

    await audio.play();

  } catch (err) {
    console.warn('[TTS] Failed, falling back to browser TTS:', err);
    await browserTTS(text);
    state.isSpeaking = false;
    updateMicButton();
  }
}

async function browserTTS(text) {
  if (!('speechSynthesis' in window)) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.0; utter.pitch = 1.0;
  return new Promise((resolve) => {
    utter.onend = utter.onerror = resolve;
    speechSynthesis.speak(utter);
  });
}

// ─── Speech recognition ───────────────────────────────────────────────────────
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = false; rec.interimResults = true; rec.lang = 'en-US';

  rec.onresult = (e) => {
    const result = e.results[e.results.length - 1];
    const t = result[0].transcript.trim();
    if (result.isFinal && t) {
      $('#message-input').value = t;
      stopRecording();
      sendMessage();
    }
  };
  rec.onerror = (e) => {
    if (e.error !== 'no-speech') toast('Voice error — try again.', 'error');
    stopRecording();
  };
  rec.onend = () => { if (state.isRecording) stopRecording(); };
  return rec;
}

function startRecording() {
  if (!state.apiKey) { openSettings(); return; }
  if (!state.speechRec) state.speechRec = initSpeechRecognition();
  if (!state.speechRec) { toast('Speech recognition not supported in this browser.', 'error'); return; }
  state.isRecording = true;
  updateMicButton();
  try { state.speechRec.start(); } catch { state.isRecording = false; updateMicButton(); }
}

function stopRecording() {
  state.isRecording = false;
  updateMicButton();
  try { state.speechRec?.stop(); } catch { /* ignore */ }
}

function updateMicButton() {
  const btn = $('#mic-btn');
  if (state.isRecording) {
    btn.classList.add('recording'); btn.classList.remove('speaking');
    btn.title = 'Listening… tap to stop';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
  } else if (state.isSpeaking) {
    btn.classList.remove('recording'); btn.classList.add('speaking');
    btn.title = 'Speaking…';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
  } else {
    btn.classList.remove('recording', 'speaking');
    btn.title = 'Tap to speak';
    btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
  }
}

// ─── Message sending ──────────────────────────────────────────────────────────
async function sendMessage() {
  const text = $('#message-input').value.trim();
  if (!text || state.isTyping) return;
  if (!state.apiKey) { openSettings(); return; }

  $('#message-input').value = '';
  $('#message-input').style.height = 'auto';
  addMessage('user', text);
  setTyping(true);

  try {
    const payload = { input: text };
    if (state.personaId) payload.persona_id = state.personaId;
    if (state.conversationId) payload.conversation_id = state.conversationId;

    const resp = await fetch(ASK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${state.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (resp.status === 401) {
      setTyping(false);
      toast('Invalid API key — check settings.', 'error');
      addMessage('system', 'Authentication failed. Check your Zo API key in Settings.');
      return;
    }

    if (!resp.ok) throw new Error(`API ${resp.status}`);

    const data = await resp.json();

    if (data.conversation_id) {
      state.conversationId = data.conversation_id;
      localStorage.setItem(`${NS}conversation_id`, data.conversation_id);
    }

    setTyping(false);
    const reply = data.output || "I didn't receive a response. Please try again.";
    addMessage('assistant', reply);
    await speakText(reply);

  } catch (err) {
    console.error('[API]', err);
    setTyping(false);
    toast('Connection error — check your network.', 'error');
    addMessage('system', `Request failed: ${err.message}`);
  }
}

// ─── Settings panel HTML ──────────────────────────────────────────────────────
function buildSettingsPanel() {
  const voiceOptions = Object.keys(VOICE_PRESETS).map(v =>
    `<option value="${v}">${v}</option>`
  ).join('');

  return `
    <div class="settings-backdrop" id="settings-backdrop"></div>
    <div class="settings-panel">
      <div class="settings-title">
        <span>⚙️  Settings</span>
        <button class="settings-close" id="settings-close">
          <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="setting-group">
        <label class="setting-label">Zo API Key</label>
        <input type="password" class="setting-input" id="api-key-input"
          placeholder="zo_sk_…" autocomplete="off" spellcheck="false"/>
        <p class="setting-hint">
          Get a token from <a href="https://zo.computer/settings" target="_blank">Settings → Advanced → Access Tokens</a>
        </p>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-group">
        <label class="setting-label">Persona ID</label>
        <input type="text" class="setting-input" id="persona-id-input"
          placeholder="e.g. fe5d7648-140a-4277-a7d4-7d8d7bf4aee8"
          autocomplete="off" spellcheck="false"/>
        <p class="setting-hint">
          Find persona IDs in
          <a href="/?t=settings&s=ai&d=personas" target="_blank">Settings → AI → Personas</a>.
          Leave blank to use your Zo default.
        </p>
      </div>

      <div class="setting-group">
        <label class="setting-label">Assistant Name</label>
        <input type="text" class="setting-input" id="assistant-name-input"
          placeholder="e.g. Alaric" autocomplete="off"/>
        <p class="setting-hint">Displayed in the header and conversation bubbles.</p>
      </div>

      <div class="setting-divider"></div>

      <div class="setting-group">
        <label class="setting-label">Voice</label>
        <select class="setting-select" id="voice-select">${voiceOptions}</select>
        <p class="setting-hint">
          ElevenLabs voice for TTS. Requires <code>ELEVENLABS_API_KEY</code> in
          <a href="/?t=settings&s=advanced" target="_blank">Zo Settings → Advanced → Secrets</a>.
        </p>
      </div>

      <div class="setting-group">
        <label class="setting-label">TTS Endpoint (optional)</label>
        <input type="text" class="setting-input" id="tts-endpoint-input"
          placeholder="https://yourhost.zo.space/api/tts" autocomplete="off"/>
        <p class="setting-hint">
          Your ElevenLabs proxy URL. Leave blank to use browser speech synthesis.
        </p>
      </div>

      <div class="setting-divider"></div>

      <button class="btn-save" id="settings-save">Save Settings</button>
      <div class="status-msg" id="status-msg"></div>
    </div>`;
}

// ─── Init ─────────────────────────────────────────────────────────────────────
function init() {
  loadSettings();
  updateHeader();

  const sheet = document.createElement('div');
  sheet.id = 'settings-sheet';
  sheet.className = 'settings-sheet';
  sheet.innerHTML = buildSettingsPanel();
  document.body.appendChild(sheet);

  $('#settings-btn').addEventListener('click', openSettings);
  $('#settings-close').addEventListener('click', closeSettings);
  $('#settings-backdrop')?.addEventListener('click', closeSettings);
  $('#settings-save').addEventListener('click', saveSettings);

  $$('.setting-input, .setting-select').forEach(el =>
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveSettings(); })
  );

  const mic = $('#mic-btn');
  mic.addEventListener('click', () => { if (state.isRecording) stopRecording(); else startRecording(); });

  let pressTimer;
  mic.addEventListener('touchstart', (e) => { e.preventDefault(); pressTimer = setTimeout(() => startRecording(), 200); }, { passive: false });
  mic.addEventListener('touchend',   (e) => { e.preventDefault(); clearTimeout(pressTimer); if (state.isRecording) stopRecording(); }, { passive: false });
  mic.addEventListener('touchcancel', () => { clearTimeout(pressTimer); stopRecording(); });

  $('#send-btn').addEventListener('click', () => { if ($('#message-input').value.trim()) sendMessage(); });

  $('#message-input').addEventListener('input', () => {
    const el = $('#message-input');
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    $('#send-btn').disabled = !el.value.trim();
  });

  $('#message-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ($('#message-input').value.trim()) sendMessage();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) =>
      console.warn('[SW] Registration failed:', err)
    );
  }

  showConfigBanner();
  renderMessages();

  if (!state.apiKey) {
    setTimeout(() => toast('Welcome! Tap ⚙️ to configure your Zo API key.', 'info', 5000), 500);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
