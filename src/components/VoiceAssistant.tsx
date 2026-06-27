import React, { useEffect, useState, useRef } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";
import api from '../services/api'; 
import "../styles/Billing.css";

export type IntentPayload = {
  intent?: any;
  action?: any;
  text?: any;
  message?: any;
  command?: any;
  productName?: string;
  qty?: number;
  unit?: string;
  isLoose?: boolean | null;
  productSku?: string | null;
  brand?: string;
  [k: string]: any;
};

type Props = { 
  onIntent?: (
    payload: IntentPayload, 
    helpers: { speak: (text: string) => void; appendAssistantMessage: (text: string) => void; }
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
  const recognitionRef = useRef<any>(null);
  const autoSendRef = useRef(true);
  const handleSendRef = useRef<() => Promise<void> | null>(null);

  useEffect(() => {
    const SpeechClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechClass) {
      setError('Speech recognition layout interface missing.');
      return;
    }

    const r = new SpeechClass();
    r.lang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
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
      if (autoSendRef.current && handleSendRef.current) void handleSendRef.current();
    };

    r.onerror = (e: any) => {
      setError(String(e.error || "Speech error."));
      setListening(false);
    };

    recognitionRef.current = r;
    return () => { try { r.stop(); } catch (_) {} };
  }, [i18n?.language]);

  const startListening = () => {
    setError(null);
    setTranscript('');
    if (!recognitionRef.current) return;
    autoSendRef.current = true;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {}
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
    } catch {}
  };

  const appendAssistantMessage = (text: string) => {
    setMessages((s) => [...s, { from: 'assistant', text }]);
  };

  const handleSend = async () => {
    if (!transcript || !transcript.trim()) return;
    const userText = transcript.trim();
    setProcessing(true);
    setError(null);
    setTranscript(''); 

    setMessages((s) => [...s, { from: 'user', text: userText }]);
    
    try {
      const currentContextState = (window as any).conversationState || 'IDLE';
      let data;

      // Sets 'sessionMode' as a URL parameter and maps user text to 'command'
      if (currentContextState === 'WAITING_FOR_BRAND_SELECTION') {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'BRAND_SELECTION' }
        });
        data = response.data;
      } else if (currentContextState === 'WAITING_FOR_PACKAGING') {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'CONFIRM_PACKAGING' }
        });
        data = response.data;
      } else {
        data = await sendMessage(userText);
      }

      if (typeof data === 'string') data = JSON.parse(data);

      const txt = data?.text || data?.message || data?.response || JSON.stringify(data);
      const payload: IntentPayload = {
        intent: data?.intent,
        action: data?.action,
        text: txt,
        ...data,
      };

      if (onIntent) {
        onIntent(payload, { speak, appendAssistantMessage });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => { handleSendRef.current = handleSend; }, [transcript]);
  useEffect(() => { setVisible(true); }, []);

  return (
    <>
      {collapsed ? (
        <div className="voice-floating-trigger">
          <Button onClick={() => setCollapsed(false)}>🎙️ Voice Terminal</Button>
        </div>
      ) : (
        <div className="voice-terminal-window" style={{ transform: visible ? 'translateY(0)' : 'translateY(12px)', opacity: visible ? 1 : 0 }}>
          <div className="voice-terminal-card">
            <div className="voice-terminal-header">
              <div>
                <div className="voice-terminal-title">Voice Terminal Logging</div>
                <div className="voice-terminal-subtitle">Realtime operations stream</div>
              </div>
              <div className="voice-terminal-header-controls">
                <Button size="sm" variant={listening ? 'danger' : 'primary'} onClick={() => (listening ? stopListening() : startListening())}>
                  {listening ? 'Stop' : 'Listen'}
                </Button>
                <Button size="sm" variant="link" onClick={() => setCollapsed(true)} className="voice-terminal-collapse-btn">—</Button>
              </div>
            </div>
            <div className="voice-terminal-body">
              <div className="voice-transcript-box">
                {transcript || (processing ? 'Processing operation routing...' : 'Awaiting live voice input sequence...')}
              </div>
              <div className="voice-history-stream">
                {messages.length === 0 ? (
                  <div className="voice-empty-log">No execution records in current cycle.</div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className="voice-bubble-wrapper" style={{ justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}>
                      <div className={`voice-bubble ${m.from}`}>{m.text}</div>
                    </div>
                  ))
                )}
              </div>
              {error && <div className="voice-runtime-error">⚠️ {error}</div>}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceAssistant;