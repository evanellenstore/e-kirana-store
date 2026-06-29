import React, { useEffect, useState, useRef, useCallback } from "react";
import { Button, Modal, Form } from "react-bootstrap";
import { useTranslation } from "react-i18next";
import { sendMessage } from "../services/aiService";
import api from '../services/api';
import "../styles/Billing.css";

// ─── Types ────────────────────────────────────────────────────────────────────

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

type PaymentOptions = {
  applyWallet?: boolean;
  walletBalance?: number;
};

type VoiceConfig = {
  autoSendDelayMs: number;
  recognitionSafetyTimeoutMs: number;
  paymentModalOpenDelayMs: number;
  speechLang: { hi: string; default: string };
  recognition: { interimResults: boolean; continuous: boolean };
};

type Props = {
  onIntent?: (
    payload: IntentPayload,
    helpers: { speak: (text: string) => void; appendAssistantMessage: (text: string) => void; }
  ) => void;
  onOpenPayment?: (mobileNumber?: string, options?: PaymentOptions) => void;
};

// ─── Internal Payment Modal ───────────────────────────────────────────────────

type PaymentModalProps = {
  show: boolean;
  mobileNumber?: string;
  walletBalance?: number;
  applyWallet?: boolean;
  onClose: () => void;
  onConfirmPayment: (mobile?: string, useWallet?: boolean) => void;
};

const PaymentModal: React.FC<PaymentModalProps> = ({
  show,
  mobileNumber,
  walletBalance,
  applyWallet,
  onClose,
  onConfirmPayment,
}) => {
  const [mobile, setMobile] = useState(mobileNumber || '');
  const [mobileError, setMobileError] = useState('');
  const [useWallet, setUseWallet] = useState<boolean>(applyWallet ?? false);

  useEffect(() => { setMobile(mobileNumber || ''); }, [mobileNumber]);
  useEffect(() => { setUseWallet(applyWallet ?? false); }, [applyWallet]);

  const handleSubmit = () => {
    if (mobile && !/^\d{10}$/.test(mobile)) {
      setMobileError('Please enter a valid 10-digit mobile number.');
      return;
    }
    setMobileError('');
    onConfirmPayment(mobile || undefined, useWallet);
  };

  const hasWallet = walletBalance !== undefined && walletBalance > 0;

  return (
    <Modal show={show} onHide={onClose} centered backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>💳 Payment</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted mb-3" style={{ fontSize: '0.92rem' }}>
          Providing your mobile number is <strong>optional</strong>. If you share it, a
          discount will be credited to your wallet.
        </p>

        <Form.Group className="mb-3">
          <Form.Label>Mobile Number <span className="text-muted">(optional)</span></Form.Label>
          <Form.Control
            type="tel"
            inputMode="numeric"
            placeholder="Enter 10-digit mobile number"
            value={mobile}
            maxLength={10}
            onChange={e => {
              setMobileError('');
              setMobile(e.target.value.replace(/\D/g, ''));
            }}
          />
          {mobileError && (
            <Form.Text className="text-danger">{mobileError}</Form.Text>
          )}
          {mobile.length === 10 && !mobileError && (
            <Form.Text className="text-success">
              ✓ Discount will be credited to your wallet.
            </Form.Text>
          )}
          {!mobile && (
            <Form.Text className="text-muted">
              Skip to proceed without a discount.
            </Form.Text>
          )}
        </Form.Group>

        {hasWallet && (
          <Form.Group
            className="mb-2 p-3 rounded"
            style={{
              background: 'var(--bs-light, #f8f9fa)',
              border: '1px solid var(--bs-border-color, #dee2e6)',
            }}
          >
            <div className="d-flex align-items-center justify-content-between mb-1">
              <Form.Label className="mb-0 fw-semibold">
                💰 Wallet Balance: <span className="text-success">₹{walletBalance}</span>
              </Form.Label>
              <Form.Check
                type="switch"
                id="wallet-switch"
                label={useWallet ? 'Applied' : 'Apply'}
                checked={useWallet}
                onChange={e => setUseWallet(e.target.checked)}
              />
            </div>
            {useWallet ? (
              <Form.Text className="text-success">
                ✓ ₹{walletBalance} will be deducted from wallet at checkout.
              </Form.Text>
            ) : (
              <Form.Text className="text-muted">
                Toggle to apply your wallet balance toward this bill.
              </Form.Text>
            )}
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={() => onConfirmPayment(undefined, false)}>
          Skip &amp; Pay
        </Button>
        <Button variant="primary" onClick={handleSubmit}>
          {mobile ? 'Confirm &amp; Pay' : 'Pay Now'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const VoiceAssistant: React.FC<Props> = ({ onIntent, onOpenPayment }) => {

  // ── Config ref ─────────────────────────────────────────────────────────────
  const voiceConfigRef = useRef<VoiceConfig>({
    autoSendDelayMs: 1,
    recognitionSafetyTimeoutMs: 15000,
    paymentModalOpenDelayMs: 300,
    speechLang: {
      hi: 'hi-IN',
      default: 'en-IN',
    },
    recognition: {
      interimResults: true,
      continuous: false,
    },
  });

  // ── State ──────────────────────────────────────────────────────────────────
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'assistant'; text: string }>>([]);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMobile, setPaymentMobile] = useState<string | undefined>(undefined);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({});

  // ── Refs ───────────────────────────────────────────────────────────────────
  const { i18n } = useTranslation();
  const recognitionRef = useRef<any>(null);
  const autoSendRef = useRef(true);
  // FIX: store transcript in a ref so onend closure always reads the latest value
  const transcriptRef = useRef<string>("");

  const wakeRecognitionRef = useRef<any>(null);
  const wakeEnabledRef = useRef(true);
  const activeSessionRef = useRef(false);
  const wakeStartedRef = useRef(false);
  const assistantSpeakingRef = useRef(false);
  const processingRef = useRef(false); // mirrors processing state for use in callbacks

  // Timer refs
  const recognitionSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const paymentModalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wakeRestartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Timer helpers ──────────────────────────────────────────────────────────
  const clearSafetyTimer = () => {
    if (recognitionSafetyTimerRef.current) {
      clearTimeout(recognitionSafetyTimerRef.current);
      recognitionSafetyTimerRef.current = null;
    }
  };

  const clearAutoSendTimer = () => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
  };

  const clearPaymentModalTimer = () => {
    if (paymentModalTimerRef.current) {
      clearTimeout(paymentModalTimerRef.current);
      paymentModalTimerRef.current = null;
    }
  };

  // ── Language helper ────────────────────────────────────────────────────────
  const getLang = () =>
    (i18n?.language || navigator.language || 'en').startsWith('hi')
      ? voiceConfigRef.current.speechLang.hi
      : voiceConfigRef.current.speechLang.default;

  // ── Session reset — centralised so every exit path calls it ───────────────
  // FIX: single function to clean up after a session ends (success or failure)
  const resetSession = useCallback((shouldRestartWake: boolean = true) => {
    activeSessionRef.current = false;
    processingRef.current = false;
    setProcessing(false);

    if (shouldRestartWake) {
      const state = (window as any).conversationState || "IDLE";
      if (
        wakeEnabledRef.current &&
        !assistantSpeakingRef.current &&
        state === "IDLE"
      ) {
        // Small delay to avoid immediately re-triggering on residual audio
        wakeRestartTimerRef.current = setTimeout(() => {
          startWakeWordListener();
        }, 800);
      }
    }
  }, []);

  // ── Speech recognition setup ───────────────────────────────────────────────
  useEffect(() => {
    const SpeechClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechClass) {
      setError('Speech recognition not supported in this browser.');
      return;
    }

    const cfg = voiceConfigRef.current;
    const r = new SpeechClass();
    r.lang = getLang();
    r.interimResults = cfg.recognition.interimResults;
    r.continuous = cfg.recognition.continuous;

    r.onresult = (ev: any) => {
      const parts: string[] = [];
      for (let i = 0; i < ev.results.length; i++) {
        parts.push(ev.results[i][0].transcript);
      }
      const text = parts.join(' ');
      // FIX: update both state and ref simultaneously
      setTranscript(text);
      transcriptRef.current = text;
    };

    r.onend = () => {
      clearSafetyTimer();
      setListening(false);

      // FIX: read from ref, not state — avoids stale closure
      const currentTranscript = transcriptRef.current;

      if (!autoSendRef.current) {
        // User manually stopped — don't auto-send
        return;
      }

      // FIX: if nothing was heard, reset session and go back to wake listener
      if (!currentTranscript || !currentTranscript.trim()) {
        console.log("No transcript captured, resetting session.");
        resetSession(true);
        return;
      }

      const delay = voiceConfigRef.current.autoSendDelayMs;
      if (delay > 0) {
        autoSendTimerRef.current = setTimeout(() => {
          void handleSendRef.current?.();
        }, delay);
      } else {
        void handleSendRef.current?.();
      }
    };

    r.onerror = (e: any) => {
      clearSafetyTimer();
      clearAutoSendTimer();

      const errCode = String(e.error || '');

      // FIX: "no-speech" and "aborted" are non-fatal — don't show error, just recover
      if (errCode === 'no-speech' || errCode === 'aborted') {
        console.log(`Recognition ended with: ${errCode} — recovering silently.`);
        setListening(false);
        resetSession(true);
        return;
      }

      // FIX: "network" errors are transient — recover with a user-visible message
      if (errCode === 'network') {
        setError('Network issue with speech recognition. Retrying...');
        setListening(false);
        resetSession(true);
        return;
      }

      setError(`Speech error: ${errCode || 'unknown'}`);
      setListening(false);
      // FIX: always reset session on error so app doesn't get stuck
      resetSession(true);
    };

    recognitionRef.current = r;

    return () => {
      clearSafetyTimer();
      clearAutoSendTimer();
      clearPaymentModalTimer();
      if (wakeRestartTimerRef.current) clearTimeout(wakeRestartTimerRef.current);
      try { r.stop(); } catch (_) { }
    };
  }, [i18n?.language]);

  // ── Speech synthesis ───────────────────────────────────────────────────────
  const speak = useCallback((text: string) => {
    try {
      if (!("speechSynthesis" in window)) return;

      assistantSpeakingRef.current = true;

      try { wakeRecognitionRef.current?.stop(); } catch { }

      const ut = new SpeechSynthesisUtterance(text);
      ut.lang = getLang();

      ut.onstart = () => {
        console.log("ASSISTANT SPEAKING");
      };

      ut.onend = () => {
        assistantSpeakingRef.current = false;

        const state = (window as any).conversationState || "IDLE";
        console.log("STATE AFTER SPEAK:", state);

        const WAITING_STATES = [
          "WAITING_FOR_BRAND_SELECTION",
          "WAITING_FOR_PACKAGING",
          "WAITING_FOR_MOBILE_CONSENT",
          "WAITING_FOR_MOBILE_NUMBER",
          "WAITING_FOR_WALLET_CONSENT",
          "WAITING_FOR_PAY_CONFIRM",
          "WAITING_FOR_RECEIPT_ACTION",
        ];

        if (WAITING_STATES.includes(state)) {
          setTimeout(() => { startListening(); }, 400);
        } else if (state === "IDLE" && !activeSessionRef.current && !processingRef.current) {
          startWakeWordListener();
        }
      };

      // FIX: recover if speech synthesis itself errors
      ut.onerror = (e) => {
        console.warn("Speech synthesis error:", e);
        assistantSpeakingRef.current = false;
        // Still try to restart wake listener
        const state = (window as any).conversationState || "IDLE";
        if (state === "IDLE" && !activeSessionRef.current) {
          setTimeout(() => { startWakeWordListener(); }, 500);
        }
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(ut);

    } catch (err) {
      console.error("speak() threw:", err);
      // FIX: ensure flag resets even if speak() throws synchronously
      assistantSpeakingRef.current = false;
    }
  }, []);

  const appendAssistantMessage = useCallback((text: string) => {
    setMessages(s => [...s, { from: 'assistant', text }]);
  }, []);

  // ── Wake word listener ─────────────────────────────────────────────────────
  const handleWakeDetected = () => {
    console.log("WAKE DETECTED");
    activeSessionRef.current = true;

    try { wakeRecognitionRef.current?.stop(); } catch { }
    wakeRecognitionRef.current = null;

    speak("Yes?");
    setTimeout(() => { startListening(); }, 1000);
  };

  const startWakeWordListener = useCallback(() => {
    if (assistantSpeakingRef.current) return;
    if (wakeRecognitionRef.current) return;
    if (!wakeEnabledRef.current) return;

    const SpeechClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechClass) return;

    console.log("STARTING WAKE LISTENER");

    const wakeRec = new SpeechClass();
    wakeRec.lang = getLang();
    wakeRec.continuous = true;
    wakeRec.interimResults = false;

    wakeRec.onstart = () => { console.log("WAKE STARTED"); };

    wakeRec.onresult = (event: any) => {
      const state = (window as any).conversationState;
      console.log("CURRENT STATE:", state);

      const wakeAllowed = !state || state === "IDLE" || state === "COMPLETE";
      if (!wakeAllowed) return;

      const text = event.results[event.results.length - 1][0].transcript
        .toLowerCase().trim();
      console.log("WAKE:", text);

      if (text.includes("dukandar") || text.includes("dukanadar")) {
        handleWakeDetected();
      }
    };

    wakeRec.onerror = (e: any) => {
      console.log("WAKE ERROR", e.error);
      // FIX: clear ref on error so onend can attempt restart
      wakeRecognitionRef.current = null;
    };

    wakeRec.onend = () => {
      console.log("WAKE ENDED");
      wakeRecognitionRef.current = null;

      const state = (window as any).conversationState || "IDLE";

      if (
        wakeEnabledRef.current &&
        !assistantSpeakingRef.current &&
        !activeSessionRef.current &&
        state === "IDLE"
      ) {
        // FIX: track this timer so we can cancel it on unmount
        wakeRestartTimerRef.current = setTimeout(() => {
          startWakeWordListener();
        }, 1000);
      }
    };

    wakeRecognitionRef.current = wakeRec;

    try {
      wakeRec.start();
    } catch (e) {
      console.error("Failed to start wake listener:", e);
      wakeRecognitionRef.current = null;
    }
  }, []);

  // ── Payment modal opener ───────────────────────────────────────────────────
  const openPaymentModal = (mobileNumber?: string, options?: PaymentOptions) => {
    if (onOpenPayment) {
      onOpenPayment(mobileNumber, options);
    } else {
      clearPaymentModalTimer();
      paymentModalTimerRef.current = setTimeout(() => {
        setPaymentMobile(mobileNumber ?? '');
        setPaymentOptions(prev => ({ ...prev, ...(options ?? {}) }));
        setShowPaymentModal(true);
      }, voiceConfigRef.current.paymentModalOpenDelayMs);
    }
  };

  const handlePaymentConfirm = (mobile?: string, useWallet?: boolean) => {
    setShowPaymentModal(false);
    console.log('Payment confirmed — mobile:', mobile ?? '(none)', '| useWallet:', useWallet);
    const parts: string[] = ['Payment processed.'];
    if (mobile) parts.push(`Discount credited to ${mobile}.`);
    if (useWallet && paymentOptions.walletBalance) {
      parts.push(`₹${paymentOptions.walletBalance} deducted from wallet.`);
    }
    const msg = parts.join(' ');
    appendAssistantMessage(msg);
    speak(msg);
  };

  // ── Listening controls ─────────────────────────────────────────────────────
  const startListening = () => {
    activeSessionRef.current = true;

    try { wakeRecognitionRef.current?.stop(); } catch { }
    wakeRecognitionRef.current = null;

    setError(null);
    setTranscript('');
    transcriptRef.current = ''; // FIX: clear ref too
    autoSendRef.current = true;

    if (!recognitionRef.current) {
      setError('Speech recognition not initialised.');
      resetSession(true);
      return;
    }

    try {
      recognitionRef.current.start();
      setListening(true);

      clearSafetyTimer();
      recognitionSafetyTimerRef.current = setTimeout(() => {
        console.warn("Recognition safety timeout — force stopping.");
        try { recognitionRef.current?.stop(); } catch { }
        setListening(false);
        setError('Listening timed out. Please try again.');
        // FIX: reset session so app recovers from timeout
        resetSession(true);
      }, voiceConfigRef.current.recognitionSafetyTimeoutMs);

    } catch (err) {
      console.error("Failed to start recognition:", err);
      setError('Could not start listening. Please try again.');
      // FIX: recover instead of getting stuck
      resetSession(true);
    }
  };

  const stopListening = () => {
    clearSafetyTimer();
    clearAutoSendTimer();
    autoSendRef.current = false;
    try { recognitionRef.current?.stop(); } catch (_) { }
    setListening(false);
    // FIX: reset session when user manually stops
    resetSession(true);
  };

  // ── Send transcript to AI ──────────────────────────────────────────────────
  const handleSend = async () => {
    // FIX: read from ref for latest value, fall back to state
    const userText = (transcriptRef.current || transcript || '').trim();

    if (!userText) {
      console.log("handleSend called with empty transcript — skipping.");
      resetSession(true);
      return;
    }

    setProcessing(true);
    processingRef.current = true;
    setError(null);
    setTranscript('');
    transcriptRef.current = '';

    setMessages(s => [...s, { from: 'user', text: userText }]);

    try {
      const currentContextState = (window as any).conversationState || 'IDLE';
      let data;

      if (currentContextState === 'WAITING_FOR_BRAND_SELECTION') {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'BRAND_SELECTION' },
        });
        data = response.data;

      } else if (currentContextState === 'WAITING_FOR_PACKAGING') {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'CONFIRM_PACKAGING' },
        });
        data = response.data;

      } else if (
        currentContextState === 'WAITING_FOR_MOBILE_CONSENT' ||
        currentContextState === 'WAITING_FOR_MOBILE_NUMBER' ||
        currentContextState === 'WAITING_FOR_WALLET_CONSENT' ||
        currentContextState === 'WAITING_FOR_PAY_CONFIRM' ||
        currentContextState === 'WAITING_FOR_RECEIPT_ACTION'
      ) {
        console.log('currentContextState:', currentContextState);
        console.log('userText:', userText);

        const isNegativeResponse = /\b(no|nahi|nope|skip|don'?t|dont|without|bypass)\b/i.test(userText);
        console.log('isNegativeResponse:', isNegativeResponse);

        const sessionMode =
          currentContextState === 'WAITING_FOR_MOBILE_CONSENT' && isNegativeResponse
            ? 'CONFIRM_WITHOUTMOBILE'
            : currentContextState;

        console.log('sessionMode being sent:', sessionMode);

        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode },
        });
        data = { ...response.data, command: userText };

      } else if (/\b(take\s*payment|payment|pay|checkout|bill\s*pay|bhugtan)\b/i.test(userText)) {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'TAKE_PAYMENT' },
        });
        data = response.data;

      } else {
        data = await sendMessage(userText);
      }

      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // FIX: if response is plain text (not JSON), wrap it so the rest of the code works
          data = { text: data };
        }
      }

      // FIX: guard against null/undefined response
      if (!data) {
        throw new Error('Empty response from server.');
      }

      const txt = data?.text || data?.message || data?.response || JSON.stringify(data);
      const intentPayload: IntentPayload = {
        intent: data?.intent,
        action: data?.action,
        text: txt,
        command: data?.command ?? userText,
        ...data,
      };

      if (onIntent) {
        // FIX: wrap onIntent in try/catch — a crash here would skip the finally block
        try {
          onIntent(intentPayload, { speak, appendAssistantMessage });
        } catch (intentErr) {
          console.error("onIntent handler threw:", intentErr);
          const fallback = "Sorry, there was an issue processing that.";
          appendAssistantMessage(fallback);
          speak(fallback);
        }
      }

    } catch (err: any) {
      console.error("handleSend error:", err);
      const errMsg = err?.response?.data?.message || err?.message || String(err);
      setError(errMsg);

      // FIX: speak an error message so the user knows something went wrong
      // and the app stays in a usable state
      const voiceError = "Sorry, I couldn't process that. Please try again.";
      appendAssistantMessage(voiceError);
      speak(voiceError);

    } finally {
      // FIX: always reset active session flag so wake listener can restart
      activeSessionRef.current = false;
      processingRef.current = false;
      setProcessing(false);
    }
  };

  // FIX: ref must capture the latest handleSend *and* the latest transcript
  const handleSendRef = useRef<() => Promise<void>>(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  useEffect(() => { setVisible(true); }, []);

  useEffect(() => {
    if (wakeStartedRef.current) return;
    wakeStartedRef.current = true;
    startWakeWordListener();

    return () => {
      wakeEnabledRef.current = false;
      if (wakeRestartTimerRef.current) clearTimeout(wakeRestartTimerRef.current);
      try { wakeRecognitionRef.current?.stop(); } catch { }
      wakeRecognitionRef.current = null;
    };
  }, []);

  (window as any).__voiceOpenPaymentModal = openPaymentModal;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {!onOpenPayment && (
        <PaymentModal
          key={`${paymentMobile || 'no-mobile'}-${paymentOptions.applyWallet}-${paymentOptions.walletBalance}`}
          show={showPaymentModal}
          mobileNumber={paymentMobile}
          walletBalance={paymentOptions.walletBalance}
          applyWallet={paymentOptions.applyWallet}
          onClose={() => setShowPaymentModal(false)}
          onConfirmPayment={handlePaymentConfirm}
        />
      )}

      {collapsed ? (
        <div className="voice-floating-trigger">
          <Button onClick={() => setCollapsed(false)}>🎙️ Voice Terminal</Button>
        </div>
      ) : (
        <div
          className="voice-terminal-window"
          style={{
            transform: visible ? 'translateY(0)' : 'translateY(12px)',
            opacity: visible ? 1 : 0,
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
                  disabled={processing}
                >
                  {listening ? 'Stop' : processing ? 'Processing…' : 'Listen'}
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
                {transcript || (processing
                  ? 'Processing operation routing...'
                  : 'Awaiting live voice input sequence...'
                )}
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