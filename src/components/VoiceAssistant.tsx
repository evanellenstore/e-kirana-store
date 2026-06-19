import React, { useEffect, useState, useRef } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";

type IntentPayload = { intent?: string; action?: string; text?: string; [k: string]: any };

type Props = { 
  onIntent?: (
    payload: IntentPayload, 
    helpers: { 
      speak: (text: string) => void;
      appendAssistantMessage: (text: string) => void;
    }
  ) => void 
};

const VoiceAssistant: React.FC<Props> = ({ onIntent }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'assistant'; text: string }>>([]);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { i18n } = useTranslation();

  const mediaActivatedRef = useRef(false);
  const mediaSourceRef = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; gain: GainNode } | null>(null);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const autoSendRef = useRef(true);
  
  const listeningRef = useRef(listening);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  const handleSendRef = useRef<() => Promise<void> | null>(null);

  useEffect(() => {
    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Speech recognition not supported in this browser environment.');
      return;
    }

    const r = new SpeechRecognitionClass();
    const speechLang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
    r.lang = speechLang;
    r.interimResults = true;
    r.continuous = false;

    r.onresult = (ev: any) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        parts.push(ev.results[i][0].transcript);
      }
      setTranscript(parts.join(" "));
    };

    r.onend = () => {
      setListening(false);
      if (autoSendRef.current && handleSendRef.current) {
        void handleSendRef.current();
      }
    };

    r.onerror = (e: any) => {
      setError(String(e.error || "Speech integration runtime error context."));
      setListening(false);
    };

    recognitionRef.current = r;
    return () => { try { r.stop(); } catch (_) {} };
  }, [i18n?.language]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    const r = recognitionRef.current;
    if (!r) return;
    autoSendRef.current = true;

    try {
      if (!mediaActivatedRef.current) {
        const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.000001, ctx.currentTime);
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
      }
      r.start();
      setListening(true);
    } catch (e) {}
  };

  const stopListening = () => {
    try { recognitionRef.current?.stop(); } catch (_) {}
    autoSendRef.current = false;
    setListening(false);
  };

  const speak = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(ut);
    } catch (e) {}
  };

  // State log mutation function made explicit to external event streams
  const appendAssistantMessage = (text: string) => {
    setMessages((s) => [...s, { from: 'assistant', text }]);
  };

  const handleSend = async () => {
    if (!transcript || !transcript.trim()) return;
    const userText = transcript.trim();
    setProcessing(true);
    setError(null);
    setTranscript(''); 

    // Visual placement tracking code: Spoken query directly appended onto the RIGHT side layout
    setMessages((s) => [...s, { from: 'user', text: userText }]);
    
    try {
      const data = await sendMessage(userText);
      const txt = data?.text || data?.message || data?.response || JSON.stringify(data);
      
      const payload: IntentPayload = {
        intent: data?.intent,
        action: data?.action,
        text: txt,
        ...data,
      };

      if (onIntent) {
        onIntent(payload, { speak, appendAssistantMessage });
      } else {
        setMessages((s) => [...s, { from: 'assistant', text: String(txt) }]);
        speak(String(txt));
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => { handleSendRef.current = handleSend; }, [transcript]);

  useEffect(() => {
    setVisible(true);
    return () => {
      const ms = mediaSourceRef.current;
      if (ms) {
        try { ms.src.stop(); ms.src.disconnect(); ms.gain.disconnect(); ms.ctx.close(); } catch (_) {}
      }
    };
  }, []);

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
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Voice Terminal Logging</div>
                <div style={{ fontSize: 12, color: '#6b7280' }}>Realtime cart status display</div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <Button size="sm" variant={listening ? 'danger' : 'primary'} onClick={() => (listening ? stopListening() : startListening())} style={{ borderRadius: 8 }}>
                  {listening ? 'Stop' : 'Listen'}
                </Button>
                <Button size="sm" variant="link" onClick={() => setCollapsed(true)} style={{ color: '#6b7280', textDecoration: 'none' }}>—</Button>
              </div>
            </div>

            <div style={{ padding: 12 }}>
              <div style={{ borderRadius: 8, padding: 8, minHeight: 48, background: '#fff', border: '1px solid rgba(0,0,0,0.06)', whiteSpace: 'pre-wrap', color: '#111827', fontSize: 13 }}>
                {transcript || 'Awaiting live vocal audio input sequence...'}
              </div>

              <div style={{ marginTop: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                {messages.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#6b7280' }}>No verification operations processed yet.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      <div style={{ 
                        background: m.from === 'user' ? '#e9ecef' : '#d4edda', 
                        color: m.from === 'user' ? '#212529' : '#0f5132', 
                        borderLeft: m.from === 'assistant' ? '4px solid #198754' : 'none',
                        borderRight: m.from === 'user' ? '4px solid #495057' : 'none',
                        padding: '8px 12px', 
                        borderRadius: 12, 
                        maxWidth: '78%', 
                        whiteSpace: 'pre-wrap', 
                        fontSize: 13, 
                        lineHeight: 1.35,
                        fontWeight: 500
                      }}>
                        {m.text}
                      </div>
                    </div>
                  ))
                )}
              </div>
              {error && (<div style={{ marginTop: 8, color: 'crimson', fontSize: 13 }}>{error}</div>)}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;