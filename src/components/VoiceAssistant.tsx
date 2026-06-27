import React, { useEffect, useState, useRef } from "react";
import { Button, Modal, Form } from "react-bootstrap";
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

type PaymentOptions = {
  applyWallet?: boolean;
  walletBalance?: number;
};



type Props = {
  onIntent?: (
    payload: IntentPayload,
    helpers: { speak: (text: string) => void; appendAssistantMessage: (text: string) => void; }
  ) => void;
  /**
   * Called when the voice flow has collected the mobile number (or undefined if
   * the user skipped) and the payment modal should open.
   * Now also receives optional PaymentOptions (e.g. applyWallet, walletBalance).
   * If you pass this prop, VoiceAssistant will NOT render its own payment modal.
   */
  onOpenPayment?: (mobileNumber?: string, options?: PaymentOptions) => void;
};

// ─── internal payment modal ──────────────────────────────────────────────────

type PaymentModalProps = {
  show: boolean;
  mobileNumber?: string;
  walletBalance?: number;       // pre-fetched wallet balance (if any)
  applyWallet?: boolean;        // whether voice already said "use wallet"
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
  // Pre-tick the checkbox if voice already confirmed wallet use
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

        {/* Mobile number field */}
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

        {/* Wallet balance section — shown only when balance is available */}
        {hasWallet && (
          <Form.Group className="mb-2 p-3 rounded" style={{ background: 'var(--bs-light, #f8f9fa)', border: '1px solid var(--bs-border-color, #dee2e6)' }}>
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
            {useWallet && (
              <Form.Text className="text-success">
                ✓ ₹{walletBalance} will be deducted from wallet at checkout.
              </Form.Text>
            )}
            {!useWallet && (
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

// ─── main component ──────────────────────────────────────────────────────────

const VoiceAssistant: React.FC<Props> = ({ onIntent, onOpenPayment }) => {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [processing, setProcessing] = useState(false);
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'assistant'; text: string }>>([]);
  const [visible, setVisible] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment modal state (used when parent does NOT supply onOpenPayment)
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMobile, setPaymentMobile] = useState<string | undefined>(undefined);
  const [paymentOptions, setPaymentOptions] = useState<PaymentOptions>({});

  const { i18n } = useTranslation();
  const recognitionRef = useRef<any>(null);
  const autoSendRef = useRef(true);
  const handleSendRef = useRef<() => Promise<void> | null>(null);

  // ── speech recognition setup ───────────────────────────────────────────────
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

  // ── speech synthesis ───────────────────────────────────────────────────────
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
    setMessages(s => [...s, { from: 'assistant', text }]);
  };

  // ── payment modal opener ───────────────────────────────────────────────────
  const openPaymentModal = (mobileNumber?: string, options?: PaymentOptions) => {
    if (onOpenPayment) {
      onOpenPayment(mobileNumber, options);
    } else {
      setPaymentMobile(mobileNumber);
      setPaymentOptions(options ?? {});
      setShowPaymentModal(true);
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

  // ── listening controls ─────────────────────────────────────────────────────
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

  // ── send transcript to AI ──────────────────────────────────────────────────
  const handleSend = async () => {
    if (!transcript || !transcript.trim()) return;
    const userText = transcript.trim();
    setProcessing(true);
    setError(null);
    setTranscript('');

    setMessages(s => [...s, { from: 'user', text: userText }]);

    try {
      const currentContextState = (window as any).conversationState || 'IDLE';
      let data;

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
      } else if (
        currentContextState === 'WAITING_FOR_MOBILE_CONSENT' ||
        currentContextState === 'WAITING_FOR_MOBILE_NUMBER' ||
        currentContextState === 'WAITING_FOR_WALLET_CONSENT' ||
        currentContextState === 'WAITING_FOR_PAY_CONFIRM'
      ) {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: currentContextState }
        });
        // ─── CRITICAL: always inject the raw spoken text as `command` ───────
        // The backend may transform/echo back a different `text`/`message`.
        // The handler MUST see the original user speech to parse mobile numbers,
        // yes/no answers, etc. We guarantee it here.
        data = { ...response.data, command: userText };

      } else if (/\b(take\s*payment|payment|pay|checkout|bill\s*pay|bhugtan)\b/i.test(userText)) {
        const response = await api.post('/ai/intent', { command: userText }, {
          params: { sessionMode: 'TAKE_PAYMENT' }
        });
        data = response.data;
      } else {
        data = await sendMessage(userText);
      }

      if (typeof data === 'string') data = JSON.parse(data);

      const txt = data?.text || data?.message || data?.response || JSON.stringify(data);
      const intentPayload: IntentPayload = {
        intent: data?.intent,
        action: data?.action,
        text: txt,
        // Ensure raw user speech is always preserved for context-resolution branches
        command: data?.command ?? userText,
        ...data,
      };

      if (onIntent) {
        onIntent(intentPayload, { speak, appendAssistantMessage });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => { handleSendRef.current = handleSend; }, [transcript]);
  useEffect(() => { setVisible(true); }, []);

  (window as any).__voiceOpenPaymentModal = openPaymentModal;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Internal Payment Modal (used when no onOpenPayment prop) ── */}
      {!onOpenPayment && (
        <PaymentModal
          show={showPaymentModal}
          mobileNumber={paymentMobile}
          walletBalance={paymentOptions.walletBalance}
          applyWallet={paymentOptions.applyWallet}
          onClose={() => setShowPaymentModal(false)}
          onConfirmPayment={handlePaymentConfirm}
        />
      )}

      {/* ── Voice Terminal UI ── */}
      {collapsed ? (
        <div className="voice-floating-trigger">
          <Button onClick={() => setCollapsed(false)}>🎙️ Voice Terminal</Button>
        </div>
      ) : (
        <div
          className="voice-terminal-window"
          style={{ transform: visible ? 'translateY(0)' : 'translateY(12px)', opacity: visible ? 1 : 0 }}
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