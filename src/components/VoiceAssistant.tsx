import React, { useEffect, useState, useRef } from "react";
import { Button, Spinner, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";

type IntentPayload = { intent?: string; action?: string; text?: string; [k: string]: any };
type Props = { onIntent?: (payload: IntentPayload) => void };

const VoiceAssistant: React.FC<Props> = ({ onIntent }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'assistant'; text: string }>>([]);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const mediaActivatedRef = useRef(false);
  const mediaSourceRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { i18n } = useTranslation();
  

  const recognitionRef = useRef<any>(null);
  const autoSendRef = useRef(true);

  // keep latest send handler ref for use in recognition callbacks
  const handleSendRef = useRef<() => Promise<void> | null>(null);

  

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const r = new SpeechRecognition();
    const speechLang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
    r.lang = speechLang;
    r.interimResults = true;
    r.continuous = false;

    r.onresult = (ev: any) => {
      const parts = [] as string[];
      for (let i = 0; i < ev.results.length; i++) {
        parts.push(ev.results[i][0].transcript);
      }
      setTranscript(parts.join(" "));
    };

    r.onend = () => {
      setListening(false);
      // auto-send when recognition ends (if enabled) — call latest handler directly
      try {
        if (autoSendRef.current) {
          const fn = handleSendRef.current;
          if (fn) {
            void fn();
          }
        }
      } catch (e) {
        console.warn('auto send failed', e);
      }
    };

    r.onerror = (e: any) => {
      console.warn('SpeechRecognition error', e);
      setError(String(e.error || e.message || "Speech recognition error"));
      setListening(false);
    };

    recognitionRef.current = r;
    return () => {
      try { r.stop(); } catch (_) {}
    };
  }, [i18n?.language]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    // note: transcript display is view-only; don't focus
    const r = recognitionRef.current;
    if (!r) {
      setError('SpeechRecognition not supported in this browser');
      return;
    }
    // ensure language is set before starting
    try { const speechLang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN'; if (r.lang !== speechLang) r.lang = speechLang; } catch (_) {}
    autoSendRef.current = true;
    try {
      // activate a short silent WebAudio buffer once to help browsers/OS route media keys to this page (user gesture required)
      try {
        if (!mediaActivatedRef.current && (window as any).AudioContext) {
          const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
          const gain = ctx.createGain();
          // very low gain so it's effectively silent but still a playing media element
          try { gain.gain.value = 0.000001; } catch (_) { try { gain.gain.setValueAtTime(0.000001, ctx.currentTime); } catch (_) {} }
          const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * 0.05)), ctx.sampleRate);
          const src = ctx.createBufferSource();
          src.buffer = buffer;
          src.loop = true;
          src.connect(gain);
          gain.connect(ctx.destination);
          src.start();
          mediaSourceRef.current = { ctx, src, gain };
          mediaActivatedRef.current = true;
        }
      } catch (e) { /* ignore */ }
      r.start();
      setListening(true);
      try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'playing'; } catch (_) {}
    } catch (e) {
      // ignore
    }
  };

  // clean up audio context/source on unmount
  useEffect(() => {
    return () => {
      try {
        const ms = mediaSourceRef.current;
        if (ms) {
          try { ms.src.stop(); } catch (_) {}
          try { ms.src.disconnect(); } catch (_) {}
          try { ms.gain.disconnect(); } catch (_) {}
          try { ms.ctx.close(); } catch (_) {}
        }
      } catch (_) {}
    };
  }, []);

  const stopListening = () => {
    const r = recognitionRef.current;
    try { r?.stop(); } catch (_) {}
    autoSendRef.current = false;
    setListening(false);
    try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'paused'; } catch (_) {}
  };

  const handleSend = async () => {
    if (!transcript || !transcript.trim()) return;
    const userText = transcript.trim();
    setProcessing(true);
    setError(null);
    // add user message and clear input
    setMessages((s) => [...s, { from: 'user', text: userText }]);
    setTranscript('');
    try {
      const data = await sendMessage(userText);
      const txt = data?.text || data?.message || data?.response || JSON.stringify(data);
      // add assistant response and auto-play audio
      setMessages((s) => [...s, { from: 'assistant', text: String(txt) }]);
      try { speak(String(txt)); } catch (e) { console.warn('speak failed', e); }

      const payload: IntentPayload = {
        intent: data?.intent,
        action: data?.action,
        text: data?.text || data?.message || data?.response || String(txt),
        ...data,
      };

      try { onIntent?.(payload); } catch (e) { console.warn('onIntent handler failed', e); }
    } catch (err: any) {
      console.error('AI request failed', err);
      setError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  // keep ref to latest handler so recognition callbacks can call it
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  const speak = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
      // keep reference so we can pause/resume
      (utteranceRef as any).current = ut;
      ut.onend = () => {
        try { (utteranceRef as any).current = null; if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'none'; } catch (_) {}
      };
      ut.onpause = () => { try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'paused'; } catch (_) {} };
      ut.onresume = () => { try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'playing'; } catch (_) {} };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(ut);
      try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'playing'; } catch (_) {}
    } catch (e) {
      console.warn('TTS failed', e);
    }
  };

  const utteranceRef = useRef<any>(null);

  const pauseSpeech = () => {
    try {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'paused'; } catch (_) {}
      }
    } catch (e) { console.warn('pauseSpeech failed', e); }
  };

  const resumeSpeech = () => {
    try {
      if (!('speechSynthesis' in window)) return;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        try { if ((navigator as any).mediaSession) (navigator as any).mediaSession.playbackState = 'playing'; } catch (_) {}
      }
    } catch (e) { console.warn('resumeSpeech failed', e); }
  };

  // allow controlling listen via headset/media play-pause button
  useEffect(() => {
    const keyHandler = (e: KeyboardEvent) => {
      const k = (e as any).code || (e as any).key || '';
      if (k === 'MediaPlayPause' || k === 'AudioPlay' || k === 'MediaPlay') {
        e.preventDefault();
        // If TTS is active, toggle pause/resume of speech, otherwise toggle listening
        if (('speechSynthesis' in window) && window.speechSynthesis.speaking) {
          if (window.speechSynthesis.paused) resumeSpeech(); else pauseSpeech();
        } else {
          if (listening) stopListening(); else startListening();
        }
      }
    };

    window.addEventListener('keydown', keyHandler as any);
    window.addEventListener('keyup', keyHandler as any);

    // media session (for Bluetooth/headset media buttons in some browsers)
    try {
      if ((navigator as any).mediaSession) {
        try {
          (navigator as any).mediaSession.metadata = new (window as any).MediaMetadata({ title: 'Voice Assistant', artist: 'e-kirana-store' });
        } catch (_) {}
        try { (navigator as any).mediaSession.setActionHandler('play', () => {
          if (('speechSynthesis' in window) && window.speechSynthesis.paused) resumeSpeech(); else if (!listening) startListening();
        }); } catch (_) {}
        try { (navigator as any).mediaSession.setActionHandler('pause', () => {
          if (('speechSynthesis' in window) && window.speechSynthesis.speaking) pauseSpeech(); else if (listening) stopListening();
        }); } catch (_) {}
        try { (navigator as any).mediaSession.setActionHandler('stop', () => { if (listening) stopListening(); try { window.speechSynthesis?.cancel(); } catch (_) {} }); } catch (_) {}
      }
    } catch (_) {}

    return () => {
      window.removeEventListener('keydown', keyHandler as any);
      window.removeEventListener('keyup', keyHandler as any);
      try { if ((navigator as any).mediaSession && (navigator as any).mediaSession.setActionHandler) {
        try { (navigator as any).mediaSession.setActionHandler('play', null); } catch (_) {}
        try { (navigator as any).mediaSession.setActionHandler('pause', null); } catch (_) {}
        try { (navigator as any).mediaSession.setActionHandler('stop', null); } catch (_) {}
      }} catch (_) {}
    };
  }, [listening]);

  // keyboard shortcut: press 'L' to toggle Listen (ignores input fields)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'l' || e.key === 'L') {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase?.() || '';
        const isEditable = !!(target && ((target as HTMLElement).isContentEditable));
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || isEditable) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        if (listening) stopListening(); else startListening();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [listening]);

  // show with slide animation on mount
  useEffect(() => { setVisible(true); }, []);

  return (
    <>
      {collapsed ? (
        <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 1600 }}>
          <Button onClick={() => setCollapsed(false)} style={{ borderRadius: 20, padding: '8px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)' }}>
            🎙️ Voice
          </Button>
        </div>
      ) : (
        <div style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 1600, width: 360, transform: visible ? 'translateY(0)' : 'translateY(12px)', transition: 'transform 240ms ease, opacity 240ms ease', opacity: visible ? 1 : 0 }}>
              <div style={{ borderRadius: 12, overflow: 'hidden', boxShadow: '0 10px 30px rgba(22,27,34,0.12)', background: 'white', border: '1px solid rgba(15,20,25,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'linear-gradient(90deg,#f8fafc,#ffffff)', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: listening ? '#fee2e2' : '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, position: 'relative' }} aria-hidden>
                  <div style={{ width: 12, height: 12, borderRadius: 6, background: listening ? '#ef4444' : '#6366f1', boxShadow: listening ? '0 0 10px rgba(239,68,68,0.6)' : 'none', transition: 'all 220ms ease' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>Voice Assistant</div>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>Ask questions or use speech</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Button size="sm" variant={listening ? 'danger' : 'primary'} onClick={() => (listening ? stopListening() : startListening())} style={{ borderRadius: 8 }}>
                  {listening ? 'Stop' : 'Listen'}
                </Button>
                <Button size="sm" variant="outline-primary" onClick={() => { void handleSend(); }} disabled={processing || !transcript.trim()} aria-label="Send transcript" style={{ padding: '4px 8px', display: 'none' }}>Send</Button>
                <Button size="sm" variant="outline-secondary" onClick={() => { setTranscript(''); setError(null); }} aria-label="Clear transcript" style={{ padding: '4px 8px', display: 'none' }}>Clear</Button>
                
                <Button size="sm" variant="link" onClick={() => setCollapsed(true)} style={{ color: '#6b7280', textDecoration: 'none' }}>—</Button>
              </div>
            </div>

            <div style={{ padding: 12 }}>
              <div role="status" aria-live="polite" aria-atomic="true" aria-label="Voice transcript" style={{ borderRadius: 8, padding: 8, minHeight: 48, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap', color: '#111827' }}>{transcript || 'Type or speak your query'}</div>

              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: '#6b7280' }}>{listening ? 'Listening…' : 'Idle'}</div>

              <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {messages.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6b7280' }}>No messages yet — speak or type to start.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      <div style={{ background: m.from === 'user' ? '#0b5cff' : '#f3f4f6', color: m.from === 'user' ? 'white' : '#111827', padding: '8px 12px', borderRadius: 12, maxWidth: '78%', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.35 }}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {error && (<div style={{ marginTop: 8, color: 'crimson' }}>{error}</div>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;
