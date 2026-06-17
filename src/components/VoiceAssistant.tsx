import React, { useEffect, useState, useRef } from "react";
import { Button, Spinner, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";

const VoiceAssistant: React.FC = () => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [responseText, setResponseText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { i18n } = useTranslation();

  const recognitionRef = useRef<any>(null);

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
    setResponseText(null);
    const r = recognitionRef.current;
    if (!r) {
      setError('SpeechRecognition not supported in this browser');
      return;
    }
    // ensure language is set before starting
    try { const speechLang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN'; if (r.lang !== speechLang) r.lang = speechLang; } catch (_) {}
    try {
      r.start();
      setListening(true);
    } catch (e) {
      // ignore
    }
  };

  const stopListening = () => {
    const r = recognitionRef.current;
    try { r?.stop(); } catch (_) {}
    setListening(false);
  };

  const handleSend = async () => {
    if (!transcript || !transcript.trim()) return;
    setProcessing(true);
    setError(null);
    setResponseText(null);
    try {
      const data = await sendMessage(transcript.trim());
      const txt = data?.text || data?.message || JSON.stringify(data);
      setResponseText(String(txt));
      speak(String(txt));
    } catch (err: any) {
      console.error('AI request failed', err);
      setError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  const speak = (text: string) => {
    try {
      if (!('speechSynthesis' in window)) return;
      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = (i18n?.language || navigator.language || 'en').startsWith('hi') ? 'hi-IN' : 'en-IN';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(ut);
    } catch (e) {
      console.warn('TTS failed', e);
    }
  };

  return (
    <div style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 1600, width: 320 }}>
      <div className="card p-2" style={{ boxShadow: '0 6px 18px rgba(0,0,0,0.12)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Voice Assistant</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button size="sm" variant={listening ? 'danger' : 'primary'} onClick={() => (listening ? stopListening() : startListening())}>
              {listening ? 'Stop' : 'Listen'}
            </Button>
          </div>
        </div>

        <Form.Control as="textarea" rows={3} className="mt-2" value={transcript} onChange={(e) => setTranscript(e.target.value)} />

        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button size="sm" onClick={handleSend} disabled={processing || !transcript.trim()}>
            {processing ? <><Spinner animation="border" size="sm"/> Sending</> : 'Send'}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { setTranscript(''); setResponseText(null); setError(null); }}>
            Clear
          </Button>
        </div>

        {responseText && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: '#333' }}>{responseText}</div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
              <Button size="sm" onClick={() => speak(responseText)}>Speak</Button>
              <Button size="sm" variant="outline-secondary" onClick={() => navigator.clipboard?.writeText(responseText)}>Copy</Button>
            </div>
          </div>
        )}

        {error && (<div style={{ marginTop: 8, color: 'crimson' }}>{error}</div>)}
      </div>
    </div>
  );
};

export default VoiceAssistant;
