import React, { useEffect, useState, useRef } from "react";
import { Button } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";
import "../styles/Billing.css";

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
      // Dynamic evaluation using the globally tracked window context state flag
      const isWaiting = (window as any).isWaitingForPackaging || false;

      if (isWaiting) {
        console.log("Turnaround confirmation state active. Bypassing first API call.");
        
        const directPayload: IntentPayload = {
          intent: 'CONFIRM_PACKAGING',
          text: userText,
          command: userText
        };

        if (onIntent) {
          onIntent(directPayload, { speak, appendAssistantMessage });
        } else {
          setMessages((s) => [...s, { from: 'assistant', text: userText }]);
          speak(userText);
        }
      } else {
        // Standard Execution Track (Turn 1)
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
        <div className="voice-floating-trigger">
          <Button onClick={() => setCollapsed(false)}>
            🎙️ Voice Terminal
          </Button>
        </div>
      ) : (
        <div 
          className="voice-terminal-window"
          style={{ 
            transform: visible ? 'translateY(0)' : 'translateY(12px)', 
            opacity: visible ? 1 : 0 
          }}
        >
          <div className="voice-terminal-card">
            
            <div className="voice-terminal-header">
              <div>
                <div className="voice-terminal-title">Voice Terminal Logging</div>
                <div className="voice-terminal-subtitle">Realtime operations stream</div>
              </div>
              <div className="voice-terminal-header-controls">
                <Button 
                  size="sm" 
                  variant={listening ? 'danger' : 'primary'} 
                  onClick={() => (listening ? stopListening() : startListening())}
                >
                  {listening ? 'Stop' : 'Listen'}
                </Button>
                <Button 
                  size="sm" 
                  variant="link" 
                  onClick={() => setCollapsed(true)} 
                  className="voice-terminal-collapse-btn"
                >
                  —
                </Button>
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
                    <div 
                      key={idx} 
                      className="voice-bubble-wrapper"
                      style={{ justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start' }}
                    >
                      <div className={`voice-bubble ${m.from}`}>
                        {m.text}
                      </div>
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