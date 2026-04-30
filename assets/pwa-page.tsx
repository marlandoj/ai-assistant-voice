import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Message { role: "user" | "assistant" | "system"; text: string; time: string; }

// ── Constants ─────────────────────────────────────────────────────────────────
const ZO_SPACE     = "{{ZO_HOST}}";
const TTS_ENDPOINT = `${ZO_SPACE}/api/tts`;
const ASK_ENDPOINT = `${ZO_SPACE}/api/alaric-ask`;
const RT_SESSION   = `${ZO_SPACE}/api/realtime-session`;
const RT_MODEL     = "gpt-4o-mini-realtime-preview";

interface PersonaOption { id: string; name: string; }
const STATIC_PERSONAS: PersonaOption[] = {{PERSONAS_JSON}};

const ELEVEN_VOICES: Record<string, string> = {
  Antoni: "ErXwobaYiN019PkySvjV",
  Rachel: "21m00Tcm4TlvDq8ikWAM",
  Bella:  "EXAVITQu4vr4xnSDxMaL",
  Grace:  "Yko7PKHZNXotIFUBG7I9",
};

const RT_VOICES = ["echo", "shimmer", "alloy", "ash", "coral", "sage", "verse"];

// ── Icons ─────────────────────────────────────────────────────────────────────
function MicIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}
function MicOffIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
      <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8" y1="23" x2="16" y2="23"/>
    </svg>
  );
}
function StopIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="6" width="12" height="12" rx="2"/>
    </svg>
  );
}
function VolumeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 1 0 .49-3.48"/>
    </svg>
  );
}
function EarIcon({ active }: { active: boolean }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: active ? "#22c55e" : "#a1a1aa" }}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7-3 12-6 12a3 3 0 0 1-3-3"/>
      <path d="M12 8a2 2 0 0 1 2 2c0 2.5-2 3-2 5"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  );
}
function HandsFreeIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
    </svg>
  );
}
function BoltIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ts() { return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function showToast(msg: string, type: string, setter: (t: { text: string; type: string } | null) => void, delay = 3000) {
  setter({ text: msg, type });
  setTimeout(() => setter(null), delay);
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 2, delayMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = await fetch(url, init);
    if (resp.ok || (resp.status !== 502 && resp.status !== 503)) return resp;
    if (attempt < retries) await new Promise(r => setTimeout(r, delayMs * (attempt + 1)));
  }
  return fetch(url, init);
}

// ── Animations ────────────────────────────────────────────────────────────────
const ANIMATIONS = `
@keyframes micPulseRed { 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.5)} 70%{box-shadow:0 0 0 18px rgba(239,68,68,0)} 100%{box-shadow:0 0 0 0 rgba(239,68,68,0)} }
@keyframes micPulseTeal { 0%{box-shadow:0 0 0 0 rgba(0,212,170,0.5)} 70%{box-shadow:0 0 0 18px rgba(0,212,170,0)} 100%{box-shadow:0 0 0 0 rgba(0,212,170,0)} }
@keyframes micPulseGreen { 0%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)} 70%{box-shadow:0 0 0 18px rgba(34,197,94,0)} 100%{box-shadow:0 0 0 0 rgba(34,197,94,0)} }
@keyframes msgIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
@keyframes typingBounce { 0%,60%,100%{transform:translateY(0);opacity:0.4} 30%{transform:translateY(-6px);opacity:1} }
@keyframes portraitBreathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
@keyframes portraitGlow { 0%,100%{box-shadow:0 0 40px rgba(124,58,237,0.5),0 0 80px rgba(124,58,237,0.2)} 50%{box-shadow:0 0 60px rgba(124,58,237,0.8),0 0 120px rgba(0,212,170,0.3)} }
@keyframes ring1 { 0%{transform:scale(1);opacity:0.7} 100%{transform:scale(1.7);opacity:0} }
@keyframes ring2 { 0%{transform:scale(1);opacity:0.5} 100%{transform:scale(2.1);opacity:0} }
@keyframes ring3 { 0%{transform:scale(1);opacity:0.35} 100%{transform:scale(2.6);opacity:0} }
@keyframes wakeWordPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }
@keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
`;

// ── Settings Panel ─────────────────────────────────────────────────────────────
function SettingsPanel({
  realtimeMode, rtVoice, personaId, elevenVoice,
  onSave, onClose,
}: {
  realtimeMode: boolean; rtVoice: string; personaId: string; elevenVoice: string;
  onSave: (rt: boolean, rtV: string, persona: string, elv: string) => void;
  onClose: () => void;
}) {
  const [rt, setRt]           = useState(realtimeMode);
  const [rtV, setRtV]         = useState(rtVoice);
  const [persona, setPersona] = useState(personaId);
  const [elv, setElv]         = useState(elevenVoice);
  const personas = STATIC_PERSONAS;

  const sel: React.CSSProperties = {
    width: "100%", background: "#27272a", border: "1px solid #3f3f46",
    borderRadius: 10, color: "#f4f4f5", fontSize: 14, padding: "11px 14px",
    outline: "none", appearance: "none", cursor: "pointer", fontFamily: "inherit",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#71717a", marginBottom: 8,
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: "#18181b", border: "1px solid #3f3f46",
        borderBottom: "none", borderRadius: "20px 20px 0 0",
        width: "100%", maxWidth: 600, maxHeight: "85dvh", overflowY: "auto",
        padding: "28px 28px 48px", scrollbarWidth: "thin", scrollbarColor: "#3f3f46 transparent",
      }}>
        <div style={{ width: 36, height: 4, background: "#3f3f46", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#f4f4f5" }}>⚙️ Settings</span>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #3f3f46", background: "#27272a", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><CloseIcon /></button>
        </div>

        {/* Realtime toggle */}
        <div style={{ marginBottom: 20, padding: 16, background: rt ? "rgba(124,58,237,0.08)" : "#27272a", border: `1px solid ${rt ? "rgba(124,58,237,0.3)" : "#3f3f46"}`, borderRadius: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#f4f4f5", margin: 0 }}>⚡ Realtime Mode</p>
              <p style={{ fontSize: 12, color: "#71717a", margin: "4px 0 0" }}>~300ms latency via OpenAI WebRTC</p>
            </div>
            <button onClick={() => setRt(v => !v)} style={{
              width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
              background: rt ? "#7c3aed" : "#3f3f46", position: "relative", transition: "background 0.2s",
            }}>
              <div style={{
                position: "absolute", top: 3, left: rt ? 23 : 3, width: 18, height: 18,
                borderRadius: "50%", background: "#fff", transition: "left 0.2s",
              }} />
            </button>
          </div>
        </div>

        {/* Realtime voice */}
        {rt && (
          <div style={{ marginBottom: 20 }}>
            <label style={label}>Realtime Voice (OpenAI)</label>
            <select value={rtV} onChange={e => setRtV(e.target.value)} style={sel}>
              {RT_VOICES.map(v => <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>)}
            </select>
            <p style={{ fontSize: 12, color: "#52525b", marginTop: 6 }}>Requires <code>OPENAI_API_KEY</code> in Zo Secrets.</p>
          </div>
        )}

        {/* Classic mode settings */}
        {!rt && (
          <>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>AI Persona</label>
              <select value={persona} onChange={e => setPersona(e.target.value)} style={sel}>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={label}>ElevenLabs Voice</label>
              <select value={elv} onChange={e => setElv(e.target.value)} style={sel}>
                {Object.keys(ELEVEN_VOICES).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <p style={{ fontSize: 12, color: "#52525b", marginTop: 6 }}>Requires <code>ELEVENLABS_API_KEY</code> in Zo Secrets. Falls back to browser TTS.</p>
            </div>
          </>
        )}

        <div style={{ height: 1, background: "#27272a", margin: "0 0 20px" }} />
        <button onClick={() => { onSave(rt, rtV, persona, elv); setTimeout(onClose, 300); }} style={{
          width: "100%", padding: 13, background: "#7c3aed", color: "#fff",
          fontSize: 15, fontWeight: 600, border: "none", borderRadius: 10,
          cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
        }}>
          Save Settings
        </button>
        <div style={{ marginTop: 20, padding: 16, background: "#27272a", borderRadius: 12, border: "1px solid #3f3f46" }}>
          <p style={{ fontSize: 12, color: "#52525b", lineHeight: 1.7, margin: 0 }}>
            <strong style={{ color: "#a1a1aa" }}>Privacy:</strong> In realtime mode, audio goes directly to OpenAI via a short-lived session token minted by your zo.space. No credentials are stored in the browser.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AIAssistantVoicePWA() {
  // Persisted prefs
  const [realtimeMode, setRealtimeMode] = useState(() => localStorage.getItem("asst_rt_mode") !== "false");
  const [rtVoice,      setRtVoice]      = useState(() => localStorage.getItem("asst_rt_voice") || "echo");
  const [personaId,    setPersonaId]    = useState(() => localStorage.getItem("asst_persona_id") || "{{DEFAULT_PERSONA_ID}}");
  const [elevenVoice,  setElevenVoice]  = useState(() => localStorage.getItem("asst_voice_name") || "Antoni");
  const [convId,       setConvId]       = useState(() => localStorage.getItem("asst_conversation_id") || "");

  // UI state
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [inputText,     setInputText]     = useState("");
  const [isRecording,   setIsRecording]   = useState(false);
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [isTyping,      setIsTyping]      = useState(false);
  const [showSettings,  setShowSettings]  = useState(false);
  const [toast_,        setToast_]        = useState<{ text: string; type: string } | null>(null);
  const [wakeActive,    setWakeActive]    = useState(false);

  // Realtime state
  const [rtConnected,   setRtConnected]   = useState(false);
  const [rtConnecting,  setRtConnecting]  = useState(false);
  const [rtMuted,       setRtMuted]       = useState(false);
  const [rtUserText,    setRtUserText]    = useState("");

  // Refs
  const convRef         = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const speechRec       = useRef<any>(null);
  const wakeRec         = useRef<any>(null);
  const wakeTimer       = useRef<any>(null);
  const pressTimer      = useRef<any>(null);
  const pcRef           = useRef<RTCPeerConnection | null>(null);
  const dcRef           = useRef<RTCDataChannel | null>(null);
  const audioRef        = useRef<HTMLAudioElement | null>(null);
  const localStream     = useRef<MediaStream | null>(null);
  const sendZoRef       = useRef<((text: string) => Promise<void>) | null>(null);

  // ── Inject CSS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = document.createElement("style");
    s.textContent = ANIMATIONS;
    document.head.appendChild(s);
    return () => document.head.removeChild(s);
  }, []);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (convRef.current) convRef.current.scrollTop = convRef.current.scrollHeight;
  }, [messages, isTyping, rtUserText]);

  // ── Welcome ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => showToast(
      realtimeMode ? "Tap ⚡ to start a realtime session with {{ASSISTANT_NAME}}." : "Tap the mic or type to speak with {{ASSISTANT_NAME}}.",
      "info", setToast_
    ), 800);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line

  // ── SW ───────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("{{PAGE_PATH}}/sw").catch(() => {});
  }, []);

  // ── Cleanup on unmount ───────────────────────────────────────────────────────
  useEffect(() => () => {
    disconnectRealtime();
    stopWake();
  }, []); // eslint-disable-line

  // ── TTS — declared FIRST so sendZoMessage and sendMessage can depend on it ───
  async function fallbackTTS(text: string) {
    if (!("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    return new Promise(r => { u.onend = r; u.onerror = r; speechSynthesis.speak(u); });
  }

  const speakText = useCallback(async (text: string) => {
    setIsSpeaking(true);
    try {
      const resp = await fetch(TTS_ENDPOINT, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_id: ELEVEN_VOICES[elevenVoice] || elevenVoice }),
      });
      if (!resp.ok) throw new Error(`TTS ${resp.status}`);
      const url = URL.createObjectURL(await resp.blob());
      const audio = new Audio(url);
      audio.onended = () => { URL.revokeObjectURL(url); setIsSpeaking(false); };
      audio.onerror = () => { URL.revokeObjectURL(url); fallbackTTS(text); };
      await audio.play();
    } catch { await fallbackTTS(text); setIsSpeaking(false); }
  }, [elevenVoice]);

  // ── Realtime event handler (sendZoRef, no direct deps) ───────────────────────
  const handleRtEvent = useCallback((raw: MessageEvent) => {
    let evt: any;
    try { evt = JSON.parse(raw.data); } catch { return; }

    switch (evt.type) {
      case "input_audio_buffer.speech_started":
        setIsRecording(true);
        setRtUserText("");
        break;
      case "input_audio_buffer.speech_stopped":
        setIsRecording(false);
        break;
      case "conversation.item.input_audio_transcription.delta":
        setRtUserText(t => t + (evt.delta || ""));
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (evt.transcript?.trim()) {
          const transcript = evt.transcript.trim();
          setMessages(m => [...m, { role: "user", text: transcript, time: ts() }]);
          setRtUserText("");
          sendZoRef.current?.(transcript);
        }
        break;
      case "error":
        showToast(`Realtime error: ${evt.error?.message || "unknown"}`, "error", setToast_);
        break;
    }
  }, []); // eslint-disable-line

  // ── Send via Zo (speakText declared above — no TDZ) ──────────────────────────
  const sendZoMessage = useCallback(async (text: string) => {
    if (!text || isTyping) return;
    setIsTyping(true);
    try {
      const payload: any = { input: text, persona_id: personaId };
      if (convId) payload.conversation_id = convId;
      const resp = await fetchWithRetry(ASK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      if (data.conversation_id) {
        setConvId(data.conversation_id);
        localStorage.setItem("asst_conversation_id", data.conversation_id);
      }
      setIsTyping(false);
      const reply = data.output || "No response. Please try again.";
      setMessages(m => [...m, { role: "assistant", text: reply, time: ts() }]);
      await speakText(reply);
    } catch (err: any) {
      setIsTyping(false);
      showToast(`Zo error: ${err?.message}`, "error", setToast_);
      setMessages(m => [...m, { role: "system", text: `Request failed: ${err?.message}`, time: ts() }]);
    }
  }, [isTyping, personaId, convId, speakText]);

  // Keep ref in sync so handleRtEvent can call sendZoMessage without stale closure
  useEffect(() => { sendZoRef.current = sendZoMessage; }, [sendZoMessage]);

  // ── Realtime connect ─────────────────────────────────────────────────────────
  const connectRealtime = useCallback(async () => {
    if (rtConnected || rtConnecting) return;
    setRtConnecting(true);
    try {
      const sesResp = await fetch(RT_SESSION, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: rtVoice }),
      });
      if (!sesResp.ok) {
        const err = await sesResp.json().catch(() => ({}));
        throw new Error((err as any).error || `Session error ${sesResp.status}`);
      }
      const session = await sesResp.json();
      const token = session.client_secret?.value;
      if (!token) throw new Error("No ephemeral token in session response");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      const audio = new Audio();
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

      pc.addTrack(stream.getTracks()[0]);

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.onmessage = handleRtEvent;
      dc.onopen = () => {
        setRtConnected(true);
        setRtConnecting(false);
        showToast("Realtime connected — just start talking!", "success", setToast_);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResp = await fetch(
        `https://api.openai.com/v1/realtime?model=${RT_MODEL}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/sdp" },
          body: offer.sdp,
        }
      );
      if (!sdpResp.ok) throw new Error(`OpenAI SDP error ${sdpResp.status}`);
      const answerSdp = await sdpResp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    } catch (err: any) {
      setRtConnecting(false);
      showToast(`Connect failed: ${err?.message}`, "error", setToast_);
      disconnectRealtime();
    }
  }, [rtVoice, rtConnected, rtConnecting, handleRtEvent]);

  function disconnectRealtime() {
    if (dcRef.current) { try { dcRef.current.close(); } catch {} dcRef.current = null; }
    if (pcRef.current) { try { pcRef.current.close(); } catch {} pcRef.current = null; }
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
    if (audioRef.current) { audioRef.current.srcObject = null; }
    setRtConnected(false);
    setRtConnecting(false);
    setIsRecording(false);
    setIsSpeaking(false);
    setRtUserText("");
  }

  const toggleRtMute = useCallback(() => {
    if (!localStream.current) return;
    const track = localStream.current.getAudioTracks()[0];
    if (!track) return;
    track.enabled = rtMuted;
    setRtMuted(v => !v);
    showToast(rtMuted ? "Microphone unmuted" : "Microphone muted", "info", setToast_);
  }, [rtMuted]);

  const sendRealtimeText = useCallback((text: string) => {
    setMessages(m => [...m, { role: "user", text, time: ts() }]);
    sendZoMessage(text);
  }, [sendZoMessage]);

  // ── Classic mode recording ───────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (speechRec.current) { try { speechRec.current.stop(); } catch {} }
  }, []);

  // ── sendMessage (speakText already declared above) ───────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text || inputText).trim();
    if (!msg || isTyping) return;
    setInputText(""); if (inputRef.current) inputRef.current.style.height = "auto";
    setMessages(m => [...m, { role: "user", text: msg, time: ts() }]);
    setIsTyping(true);
    try {
      const payload: any = { input: msg, persona_id: personaId };
      if (convId) payload.conversation_id = convId;
      const resp = await fetchWithRetry(ASK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error(`API ${resp.status}`);
      const data = await resp.json();
      if (data.conversation_id) { setConvId(data.conversation_id); localStorage.setItem("asst_conversation_id", data.conversation_id); }
      setIsTyping(false);
      const reply = data.output || "No response. Please try again.";
      setMessages(m => [...m, { role: "assistant", text: reply, time: ts() }]);
      await speakText(reply);
    } catch (err: any) {
      setIsTyping(false);
      showToast(`Connection error: ${err?.message}`, "error", setToast_);
      setMessages(m => [...m, { role: "system", text: `Request failed: ${err?.message}`, time: ts() }]);
    }
  }, [inputText, isTyping, personaId, convId, speakText]);

  const startRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showToast("Speech recognition not supported.", "error", setToast_); return; }
    if (!speechRec.current) {
      const rec = new SR();
      rec.continuous = false; rec.interimResults = true; rec.lang = "en-US";
      rec.onresult = (e: any) => {
        const r = e.results[e.results.length - 1];
        if (r.isFinal) { const t = r[0].transcript.trim(); if (t) { setInputText(t); stopRecording(); sendMessage(t); } }
      };
      rec.onerror = (e: any) => { if (e.error !== "no-speech") showToast("Voice error — try again.", "error", setToast_); stopRecording(); };
      rec.onend = () => { setIsRecording(false); };
      speechRec.current = rec;
    }
    setIsRecording(true);
    try { speechRec.current.start(); } catch {}
  }, [sendMessage, stopRecording]);

  // ── Wake word ─────────────────────────────────────────────────────────────────
  const WAKE_PHRASES = ["hey {{ASSISTANT_SLUG}}", "{{ASSISTANT_SLUG}}"];
  const stopWake = useCallback(() => {
    if (wakeTimer.current) { clearTimeout(wakeTimer.current); wakeTimer.current = null; }
    if (wakeRec.current) { try { wakeRec.current.stop(); } catch {} wakeRec.current = null; }
    setWakeActive(false);
  }, []);

  const startWake = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { showToast("Wake word not supported.", "error", setToast_); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim();
        if (WAKE_PHRASES.some(p => t.includes(p))) {
          const cmd = WAKE_PHRASES.reduce((s, p) => s.replace(new RegExp(p, "gi"), ""), t).trim();
          if (cmd.length > 2) {
            if (realtimeMode && rtConnected) sendRealtimeText(cmd);
            else sendMessage(cmd);
          } else {
            showToast("{{ASSISTANT_NAME}} is listening…", "info", setToast_, 1500);
            if (!realtimeMode) startRecording();
          }
          break;
        }
      }
    };
    rec.onend = () => { if (wakeRec.current) { wakeTimer.current = setTimeout(() => { try { wakeRec.current?.start(); } catch {} }, 300); } };
    rec.onerror = (e: any) => { if (e.error === "not-allowed") { stopWake(); showToast("Microphone access denied.", "error", setToast_); } };
    wakeRec.current = rec;
    try { rec.start(); setWakeActive(true); showToast('Wake word armed — say "Hey {{ASSISTANT_NAME}}"', "success", setToast_); }
    catch { showToast("Could not start wake word.", "error", setToast_); }
  }, [realtimeMode, rtConnected, sendRealtimeText, sendMessage, startRecording, stopWake]); // eslint-disable-line

  const toggleWake = useCallback(() => {
    if (wakeActive) { stopWake(); showToast("Wake word disarmed.", "info", setToast_); }
    else startWake();
  }, [wakeActive, startWake, stopWake]);

  // ── Clear session ─────────────────────────────────────────────────────────────
  const clearSession = useCallback(() => {
    if (realtimeMode && rtConnected) { disconnectRealtime(); showToast("Session ended.", "info", setToast_); }
    setMessages([]); setConvId(""); localStorage.removeItem("asst_conversation_id");
    setRtUserText("");
    if (!realtimeMode) showToast("New session started.", "success", setToast_);
  }, [realtimeMode, rtConnected]);

  // ── Save settings ─────────────────────────────────────────────────────────────
  const handleSave = (rt: boolean, rtV: string, persona: string, elv: string) => {
    if (!rt && rtConnected) disconnectRealtime();
    setRealtimeMode(rt); setRtVoice(rtV); setPersonaId(persona); setElevenVoice(elv);
    localStorage.setItem("asst_rt_mode", String(rt));
    localStorage.setItem("asst_rt_voice", rtV);
    localStorage.setItem("asst_persona_id", persona);
    localStorage.setItem("asst_voice_name", elv);
    showToast("Settings saved.", "success", setToast_);
  };

  // ── Status ────────────────────────────────────────────────────────────────────
  const statusText = realtimeMode
    ? rtConnecting ? "Connecting…" : rtConnected ? (isRecording ? "Listening…" : isSpeaking ? "Speaking…" : "Live") : "Tap ⚡ to connect"
    : isSpeaking ? "Speaking…" : isRecording ? "Listening…" : isTyping ? "Thinking…" : "Ready";

  const statusColor = rtConnecting ? "#f59e0b"
    : (rtConnected && realtimeMode) || (!realtimeMode && !isSpeaking && !isRecording && !isTyping) ? "#22c55e"
    : isSpeaking ? "#00d4aa" : isRecording ? "#ef4444" : isTyping ? "#7c3aed" : "#52525b";

  const micBtnStyle: React.CSSProperties = {
    width: 44, height: 44, borderRadius: "50%", border: "none",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0, transition: "all 0.2s",
    ...(isRecording
      ? { background: "#ef4444", animation: "micPulseRed 1.5s ease-out infinite" }
      : isSpeaking
      ? { background: "#00d4aa", animation: "micPulseTeal 1.5s ease-out infinite" }
      : (rtConnected && !rtMuted)
      ? { background: "#22c55e", animation: "micPulseGreen 2s ease-out infinite" }
      : { background: "#7c3aed" }
    ),
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100dvh",
      background: "#09090b", color: "#d4d4d8",
      fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
      position: "relative", overflow: "hidden",
    }}>
      <div style={{ position: "fixed", top: -200, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: "radial-gradient(ellipse,rgba(124,58,237,0.18) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: -150, right: -100, width: 400, height: 300, background: "radial-gradient(ellipse,rgba(6,182,212,0.1) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px 16px", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f4f4f5", lineHeight: 1.2 }}>{{ASSISTANT_NAME}}</h1>
          <p style={{ fontSize: 12, color: "#71717a", marginTop: 1 }}>Voice AI Assistant</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggleWake} title={wakeActive ? "Disarm wake word" : 'Arm wake word ("Hey {{ASSISTANT_NAME}}")'} style={{
            position: "relative", width: 38, height: 38, borderRadius: 10,
            border: `1px solid ${wakeActive ? "rgba(34,197,94,0.4)" : "#3f3f46"}`,
            background: wakeActive ? "rgba(34,197,94,0.08)" : "#27272a",
            color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <EarIcon active={wakeActive} />
            {wakeActive && <div style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#22c55e", animation: "wakeWordPulse 1.5s ease-in-out infinite" }} />}
          </button>

          {realtimeMode && (
            <button onClick={rtConnected ? () => { disconnectRealtime(); showToast("Disconnected.", "info", setToast_); } : connectRealtime}
              disabled={rtConnecting}
              title={rtConnected ? "Disconnect realtime" : "Connect realtime"}
              style={{
                width: 38, height: 38, borderRadius: 10,
                border: `1px solid ${rtConnected ? "rgba(34,197,94,0.4)" : rtConnecting ? "rgba(245,158,11,0.4)" : "#3f3f46"}`,
                background: rtConnected ? "rgba(34,197,94,0.1)" : rtConnecting ? "rgba(245,158,11,0.1)" : "#27272a",
                color: rtConnected ? "#22c55e" : rtConnecting ? "#f59e0b" : "#a1a1aa",
                cursor: rtConnecting ? "default" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
              {rtConnecting
                ? <div style={{ width: 14, height: 14, border: "2px solid #f59e0b", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : <BoltIcon />}
            </button>
          )}

          <button onClick={clearSession} title="New session" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #3f3f46", background: "#27272a", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <RefreshIcon />
          </button>

          <button onClick={() => setShowSettings(true)} title="Settings" style={{ width: 38, height: 38, borderRadius: 10, border: "1px solid #3f3f46", background: "#27272a", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <SettingsIcon />
          </button>
        </div>
      </header>

      {/* Portrait */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 8, position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ position: "relative", width: 280, height: 280, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {isSpeaking && (
            <>
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(124,58,237,0.7)", animation: "ring1 1.6s ease-out infinite" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(0,212,170,0.5)", animation: "ring2 1.6s ease-out infinite 0.4s" }} />
              <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(124,58,237,0.35)", animation: "ring3 1.6s ease-out infinite 0.8s" }} />
            </>
          )}
          <div style={{
            width: 260, height: 260, borderRadius: "50%", overflow: "hidden", flexShrink: 0,
            border: "2px solid rgba(124,58,237,0.4)",
            animation: isSpeaking
              ? "portraitBreathe 1.2s ease-in-out infinite, portraitGlow 1.2s ease-in-out infinite"
              : "portraitGlow 4s ease-in-out infinite",
          }}>
            <img src="{{PORTRAIT_PATH}}" alt="{{ASSISTANT_NAME}}" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        </div>
        <p style={{ fontSize: 12, marginTop: 8, letterSpacing: "0.06em", textTransform: "uppercase", color: statusColor, transition: "color 0.3s" }}>
          {statusText}
        </p>
        {realtimeMode && (
          <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: rtConnected ? "#22c55e" : "#52525b", background: rtConnected ? "rgba(34,197,94,0.08)" : "#18181b", border: `1px solid ${rtConnected ? "rgba(34,197,94,0.2)" : "#27272a"}`, borderRadius: 20, padding: "3px 10px" }}>
            <BoltIcon size={10} />
            <span>Realtime · {rtVoice}</span>
          </div>
        )}

        {/* ── Push-to-Talk Button ── */}
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
          <button
            style={{
              width: 80, height: 80, borderRadius: "50%", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "all 0.2s",
              ...(isRecording
                ? { background: "#ef4444", animation: "micPulseRed 1.5s ease-out infinite", boxShadow: "0 0 0 0 rgba(239,68,68,0.5)" }
                : isSpeaking
                ? { background: "#00d4aa", animation: "micPulseTeal 1.5s ease-out infinite" }
                : (realtimeMode && rtConnected && !rtMuted)
                ? { background: "#22c55e", animation: "micPulseGreen 2s ease-out infinite" }
                : { background: "#7c3aed", boxShadow: "0 4px 24px rgba(124,58,237,0.4)" }
              ),
            }}
            onClick={() => {
              if (realtimeMode) {
                if (rtConnected) toggleRtMute();
                else connectRealtime();
              } else {
                if (isRecording) stopRecording(); else startRecording();
              }
            }}
            onTouchStart={e => {
              if (!realtimeMode) { e.preventDefault(); pressTimer.current = setTimeout(startRecording, 150); }
            }}
            onTouchEnd={e => {
              if (!realtimeMode) { e.preventDefault(); if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; } stopRecording(); }
            }}
            title={realtimeMode ? (rtConnected ? (rtMuted ? "Unmute" : "Mute") : "Connect realtime") : (isRecording ? "Stop recording" : "Push to talk")}
          >
            {realtimeMode
              ? rtMuted ? <MicOffIcon size={32} /> : rtConnected ? <MicIcon size={32} /> : <BoltIcon size={32} />
              : isRecording ? <StopIcon size={32} /> : isSpeaking ? <VolumeIcon size={32} /> : <MicIcon size={32} />}
          </button>
          <span style={{ fontSize: 11, color: "#52525b", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {realtimeMode
              ? rtConnecting ? "Connecting…" : rtConnected ? (rtMuted ? "Tap to unmute" : "Tap to mute") : "Tap to connect"
              : isRecording ? "Tap to stop" : "Push to talk"}
          </span>
        </div>
      </div>

      {/* Streaming transcript */}
      {rtUserText && (
        <div style={{ padding: "0 24px 8px", position: "relative", zIndex: 10, flexShrink: 0 }}>
          <p style={{ fontSize: 13, color: "#71717a", textAlign: "right", margin: 0, fontStyle: "italic" }}>"{rtUserText}"</p>
        </div>
      )}

      {/* Conversation */}
      <main ref={convRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "8px 24px 16px", position: "relative", zIndex: 10, scrollBehavior: "smooth" }}>
        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "16px 20px", gap: 8 }}>
            <p style={{ fontSize: 14, color: "#71717a", maxWidth: 280, lineHeight: 1.6 }}>
              {realtimeMode
                ? "Tap ⚡ to start a realtime session. Then just talk naturally — no buttons needed."
                : "Tap the mic to speak with {{ASSISTANT_NAME}}, or type a message below."}
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === "user", isSystem = m.role === "system";
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 20, flexDirection: isUser ? "row-reverse" : "row", animation: "msgIn 0.3s cubic-bezier(0.22,1,0.36,1)" }}>
              <div style={{
                width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, fontSize: 13, fontWeight: 700, marginTop: 2,
                ...(m.role === "assistant" ? { background: "linear-gradient(135deg,#7c3aed,#2563eb)", color: "#fff" }
                  : isUser ? { background: "#27272a", color: "#a1a1aa", border: "1px solid #3f3f46" }
                  : { background: "#27272a", color: "#00d4aa", border: "1px solid #3f3f46" }),
              }}>
                {isUser ? "U" : isSystem ? "⚡" : "A"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxWidth: "82%", alignItems: isUser ? "flex-end" : "flex-start" }}>
                <div style={{
                  padding: "12px 16px", borderRadius: 20, fontSize: 15, lineHeight: 1.55, wordBreak: "break-word",
                  ...(isUser ? { background: "#7c3aed", color: "#fff", borderBottomRightRadius: 4 }
                    : isSystem ? { background: "rgba(0,212,170,0.08)", border: "1px solid rgba(0,212,170,0.2)", color: "#00d4aa", fontSize: 13, borderRadius: 12 }
                    : { background: "#27272a", border: "1px solid #3f3f46", borderBottomLeftRadius: 4, color: "#f4f4f5" }),
                }}>
                  {m.text.split("\n").map((l, li) => <p key={li} style={{ margin: 0 }}>{l || <br />}</p>)}
                </div>
                <span style={{ fontSize: 10, color: "#52525b", padding: "0 4px" }}>{m.time}</span>
              </div>
            </div>
          );
        })}
        {isTyping && (
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg,#7c3aed,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 13, fontWeight: 700, color: "#fff" }}>A</div>
            <div style={{ background: "#27272a", border: "1px solid #3f3f46", borderBottomLeftRadius: 4, borderRadius: 20, padding: "14px 18px", display: "flex", alignItems: "center", gap: 6 }}>
              {[0, 1, 2].map(d => <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#71717a", animation: `typingBounce 1.2s ease-in-out infinite ${d * 0.2}s` }} />)}
            </div>
          </div>
        )}
      </main>

      {/* Input */}
      <div style={{ padding: "12px 20px 32px", position: "relative", zIndex: 10, flexShrink: 0 }}>
        <div style={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 20, display: "flex", alignItems: "flex-end", gap: 8, padding: "8px 8px 8px 16px" }}>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => {
              setInputText(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (inputText.trim()) {
                  if (realtimeMode && rtConnected) { sendRealtimeText(inputText.trim()); setInputText(""); }
                  else sendMessage();
                }
              }
            }}
            rows={1} placeholder="Message {{ASSISTANT_NAME}}…"
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "#f4f4f5", fontSize: 15, lineHeight: 1.5, resize: "none",
              minHeight: 24, maxHeight: 120, overflowY: "auto", padding: "3px 0",
              caretColor: "#7c3aed", fontFamily: "inherit",
            }}
          />

          <button
            onClick={() => {
              if (realtimeMode && rtConnected) { sendRealtimeText(inputText.trim()); setInputText(""); }
              else sendMessage();
            }}
            disabled={!inputText.trim() || isTyping}
            style={{
              width: 44, height: 44, borderRadius: "50%", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              background: inputText.trim() && !isTyping ? "#7c3aed" : "#27272a", color: "#fff",
              boxShadow: inputText.trim() && !isTyping ? "0 4px 16px rgba(124,58,237,0.3)" : "none",
              transition: "all 0.15s",
            }}
          ><SendIcon /></button>
        </div>
      </div>

      {/* Toast */}
      {toast_ && (
        <div style={{
          position: "fixed", bottom: 100, left: "50%", transform: "translateX(-50%)",
          background: "#27272a", border: `1px solid ${toast_.type === "error" ? "rgba(239,68,68,0.4)" : toast_.type === "success" ? "rgba(34,197,94,0.4)" : "#3f3f46"}`,
          borderRadius: 12, padding: "10px 18px", fontSize: 13,
          color: toast_.type === "error" ? "#ef4444" : toast_.type === "success" ? "#22c55e" : "#d4d4d8",
          zIndex: 200, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        }}>
          {toast_.text}
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <SettingsPanel
          realtimeMode={realtimeMode} rtVoice={rtVoice}
          personaId={personaId} elevenVoice={elevenVoice}
          onSave={handleSave}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
