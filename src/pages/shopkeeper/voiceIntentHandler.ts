import api from '../../services/api'; 
import i18n from '../../i18n/config';

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

export type VoiceDeps = {
  billId?: string | undefined;
  handleStartBilling: () => Promise<void> | void;
  setShowUnifiedControlsModal: (v: boolean) => void;
  setUnifiedModalTab: (t: 'payment' | 'inventory' | 'refund' | 'rewards') => void;
  setNotificationMessage: (m: string) => void;
  setNotificationType: (t: 'success' | 'danger' | 'warning' | 'info') => void;
  setShowNotification: (b: boolean) => void;
  t?: (k: string, opts?: any) => string;
  addCartItems?: (items: any[]) => void;
  playBeep?: () => Promise<void>;
  speak?: (text: string) => void;
  appendAssistantMessage?: (text: string) => void;
  openPaymentModal?: (mobileNumber?: string, options?: PaymentOptions) => void;
  /**
   * Fetch wallet balance for a given mobile number.
   * Should resolve to a number (the balance), or null/undefined if not found.
   */
  fetchWalletBalance?: (mobile: string) => Promise<number | null>;
  onReceiptPrint?: () => void;
  onReceiptClose?: () => void;
  onReceiptDone?: () => void;

};

export type BrandCandidate = {
  brand: string;
  productSku: string;
  productName: string;
};

export type PendingBrandState = {
  originalRequest: IntentPayload;
  candidates: BrandCandidate[];
};

let pendingRequestState: IntentPayload | null = null;
let pendingBrandState: PendingBrandState | null = null;

// Stores the mobile number collected during the payment flow
let pendingPaymentMobile: string | null = null;
// Stores the wallet balance fetched for the mobile
let pendingWalletBalance: number | null = null;

if (typeof window !== 'undefined') {
  (window as any).conversationState = 'IDLE';
}

function buildCandidateString(payload: IntentPayload) {
  const parts: string[] = [];
  try {
    if (payload?.intent) parts.push(String(payload.intent));
    if (typeof payload?.intent === 'object' && payload.intent?.name) parts.push(String(payload.intent.name));
  } catch {}
  try { if (payload?.action) parts.push(String(payload.action)); } catch {}
  try { if (payload?.text) parts.push(String(payload.text)); } catch {}
  try { if (payload?.message) parts.push(String(payload.message)); } catch {}
  try { if (payload?.command) parts.push(String(payload.command)); } catch {}
  return parts.join(' ').toLowerCase();
}

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Extracts a 10-digit mobile number from any text.
 * Strips all non-digit characters first, so "81306 77433" → "8130677433" (10 digits ✓).
 */
function extractMobileNumber(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  return null;
}

function isAffirmative(text: string): boolean {
  return /\b(yes|yeah|yep|haan|ha|sure|ok|okay|provide|give|use|apply)\b/i.test(text);
}

function isNegative(text: string): boolean {
  return /\b(no|nahi|nope|skip|don'?t|dont|without|bypass)\b/i.test(text);
}

// ─── exported handler ────────────────────────────────────────────────────────

export async function handleVoiceIntent(payload: IntentPayload, deps: VoiceDeps) {
  try {
    console.log('voiceIntentHandler received payload:', payload);

    try {
      if (typeof payload?.text === 'string') {
        const t = payload.text.trim();
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed === 'object') {
            payload = { ...payload, ...parsed };
          }
        }
      }
    } catch (e) {}

    let act = String(payload?.intent || payload?.action || '').trim().toUpperCase();
    let txt = String(payload?.command || payload?.text || payload?.message || '').trim();

    // ─── CRITICAL FIX ────────────────────────────────────────────────────────
    // When the backend processes a session-mode request (e.g. WAITING_FOR_MOBILE_NUMBER),
    // it echoes back an AI reply in `text`/`message`, NOT the raw user speech.
    // The raw user speech is always preserved in `payload.command` (set by VoiceAssistant
    // before the API call). We must use `command` as the source of truth for parsing
    // user input in context-resolution branches.
    const rawUserSpeech = String(payload?.command || '').trim();
    // ─────────────────────────────────────────────────────────────────────────

    const candStr = buildCandidateString(payload);
    const currentContextState = (window as any).conversationState || 'IDLE';

    // =========================================================================
    // 1. BRAND_SELECTION
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_BRAND_SELECTION' && pendingBrandState) {
      const selectedBrandValue = (payload.brand || rawUserSpeech || txt || '').trim();
      const lowerBrandValue = selectedBrandValue.toLowerCase();
      const candidates = pendingBrandState.candidates;
      let selectedCandidate: BrandCandidate | null = null;

      const parsedIndex = parseInt(selectedBrandValue, 10);
      if (!isNaN(parsedIndex) && parsedIndex > 0 && parsedIndex <= candidates.length) {
        selectedCandidate = candidates[parsedIndex - 1];
      }

      if (!selectedCandidate) {
        selectedCandidate = candidates.find(c => {
          const candidateBrand = c.brand.toLowerCase();
          return candidateBrand.includes(lowerBrandValue) || lowerBrandValue.includes(candidateBrand);
        }) || null;
      }

      if (selectedCandidate) {
        payload = {
          ...pendingBrandState.originalRequest,
          intent: 'ADD_ITEM',
          productSku: selectedCandidate.productSku,
          brand: selectedCandidate.brand.trim(),
          isLoose: payload.isLoose !== undefined ? payload.isLoose : pendingBrandState.originalRequest.isLoose
        };
      } else {
        payload = {
          ...pendingBrandState.originalRequest,
          intent: 'ADD_ITEM',
          brand: selectedBrandValue || undefined,
          isLoose: payload.isLoose !== undefined ? payload.isLoose : pendingBrandState.originalRequest.isLoose
        };
      }

      act = 'ADD_ITEM';
      pendingBrandState = null;
      (window as any).conversationState = 'IDLE';
    }

    // =========================================================================
    // 2. CONFIRM_PACKAGING
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_PACKAGING' && pendingRequestState) {
      if (payload.isLoose === true || payload.isLoose === false) {
        payload = { ...pendingRequestState, isLoose: payload.isLoose };
        act = 'ADD_ITEM';
        pendingRequestState = null;
        (window as any).conversationState = 'IDLE';
      } else {
        const retryMsg = "Please clearly state loose or packet.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 3.   WAITING FOR MOBILE CONSENT
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_MOBILE_CONSENT') {
      if (isAffirmative(rawUserSpeech || txt)) {
        (window as any).conversationState = 'WAITING_FOR_MOBILE_NUMBER';
        const askMsg = "Please tell me your 10-digit mobile number.";
        deps.speak?.(askMsg);
        deps.appendAssistantMessage?.(askMsg);
        return;
      } else if (isNegative(rawUserSpeech || txt)) {
        pendingPaymentMobile = null;
        pendingWalletBalance = null;
        (window as any).conversationState = 'WAITING_FOR_PAY_CONFIRM';
        const proceedMsg = "Proceeding to payment without a mobile number. Shall I proceed with payment? Say yes or no.";
        deps.speak?.(proceedMsg);
        deps.appendAssistantMessage?.(proceedMsg);
  return;
      } else {
        const retryMsg = "Please say yes to provide your mobile number, or no to skip.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 4. PAYMENT — WAITING FOR MOBILE NUMBER DIGITS
    //    FIX: parse from rawUserSpeech (the actual spoken digits), not txt
    //    (which is the AI's echoed reply from the backend).
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_MOBILE_NUMBER') {
      // Try raw user speech first, then fall back to txt
      const mobile = extractMobileNumber(rawUserSpeech) || extractMobileNumber(txt);
    // AFTER ✅
      if (mobile) {
        pendingPaymentMobile = mobile;

        if (deps.fetchWalletBalance) {
          try {
            const balance = await deps.fetchWalletBalance(mobile);
            pendingWalletBalance = balance ?? null;
          } catch {
            pendingWalletBalance = null;
          }
        }

        // ✅ Update modal immediately with mobile number as soon as it's spoken
        _openPayment(deps, mobile, {
          applyWallet: false,
          walletBalance: pendingWalletBalance ?? undefined,
        });

        (window as any).conversationState = 'WAITING_FOR_WALLET_CONSENT';

        if (pendingWalletBalance !== null && pendingWalletBalance > 0) {
          const walletMsg = `Mobile number ${mobile} registered. You have ₹${pendingWalletBalance} in your wallet. Would you like to use your wallet balance for payment? Say yes or no.`;
          deps.speak?.(walletMsg);
          deps.appendAssistantMessage?.(walletMsg);
        } else {
          const walletMsg = `Got it! Mobile number ${mobile} saved. A discount will be credited to your wallet. Would you like to use your wallet for payment? Say yes or no.`;
          deps.speak?.(walletMsg);
          deps.appendAssistantMessage?.(walletMsg);
        }
        return;
      }
      else {
        const retryMsg = "I didn't catch that. Please say your 10-digit mobile number clearly, digit by digit if needed.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 5. PAYMENT — WAITING FOR WALLET CONSENT
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_WALLET_CONSENT') {
      const useWallet = isAffirmative(rawUserSpeech || txt);
      const skipWallet = isNegative(rawUserSpeech || txt);

 
      if (useWallet) {
        (window as any).conversationState = 'WAITING_FOR_PAY_CONFIRM';
        const mobile = pendingPaymentMobile ?? undefined;
        const balance = pendingWalletBalance ?? 0;
        // Open modal with wallet pre-checked
        _openPayment(deps, mobile, { applyWallet: true, walletBalance: balance });
        const askMsg = `Wallet ₹${balance} will be applied. Shall I proceed with payment? Say yes or no.`;
        deps.speak?.(askMsg);
        deps.appendAssistantMessage?.(askMsg);
        return;
      }

      else if (skipWallet) {
        (window as any).conversationState = 'WAITING_FOR_PAY_CONFIRM';
        const mobile = pendingPaymentMobile ?? undefined;
        pendingPaymentMobile = null;
        pendingWalletBalance = null;
        _openPayment(deps, mobile, { applyWallet: false });
        const askMsg = "Okay, wallet not applied. Shall I proceed with payment? Say yes or no.";
        deps.speak?.(askMsg);
        deps.appendAssistantMessage?.(askMsg);
        return;
      }

      else {
        const retryMsg = `You have ₹${pendingWalletBalance} in your wallet. Say yes to use it, or no to skip.`;
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }


// =========================================================================
// 6. PAYMENT — WAITING FOR FINAL PAY CONFIRMATION
// =========================================================================
    if (currentContextState === 'WAITING_FOR_PAY_CONFIRM') {
      if (isAffirmative(rawUserSpeech || txt)) {
        (window as any).conversationState = 'IDLE';
        pendingPaymentMobile = null;
        pendingWalletBalance = null;
        // Yes — click the Pay button exactly as user would manually
        const payBtn = document.querySelector('button.btn-success') as HTMLButtonElement;
        if (payBtn) payBtn.click();
        setTimeout(() => {
          (window as any).conversationState = 'WAITING_FOR_RECEIPT_ACTION';
          const receiptMsg = "Payment done! Say print to print receipt, done to finish, or close to close.";
          deps.speak?.(receiptMsg);
          deps.appendAssistantMessage?.(receiptMsg);
        }, 2000);
        const msg = "Processing payment now!";
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
        return;
      } else if (isNegative(rawUserSpeech || txt)) {
        // No — do nothing, just cancel
        (window as any).conversationState = 'IDLE';
        pendingPaymentMobile = null;
        pendingWalletBalance = null;
        const msg = "Payment cancelled. You can pay manually when ready.";
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
        return;
      } else {
        const retryMsg = "Say yes to confirm payment, or no to cancel.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 7. MAIN SERVICE ROUTING PIPELINE TRACK
    // =========================================================================
    // =========================================================================
    // 7. RECEIPT ACTION — PRINT / CLOSE / DONE
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_RECEIPT_ACTION') {
      const input = (rawUserSpeech || txt).toLowerCase();
      if (/\bprint\b/i.test(input)) {
        (window as any).conversationState = 'IDLE';
        deps.onReceiptPrint?.();
        const msg = "Printing receipt now.";
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
        return;
      } else if (/\bdone\b/i.test(input)) {
        (window as any).conversationState = 'IDLE';
        deps.onReceiptDone?.();
        const msg = "Bill done. Ready for next customer.";
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
        return;
      } else if (/\bclose\b/i.test(input)) {
        (window as any).conversationState = 'IDLE';
        deps.onReceiptClose?.();
        const msg = "Receipt closed.";
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
        return;
      } else {
        const retryMsg = "Say print to print receipt, done to finish, or close to close.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 8. MAIN SERVICE ROUTING PIPELINE TRACK
    // =========================================================================






    // ── PAYMENT intent ───────────────────────────────────────────────────────
    const isPaymentIntent =
      act === 'PAYMENT' ||
      act === 'TAKE_PAYMENT' ||
      act === 'PAY' ||
      /\b(payment|pay|checkout|bill\s*pay|bhugtan)\b/i.test(candStr);

    // AFTER ✅
    if (isPaymentIntent) {
      if (!deps.billId) {
        const noBillMsg = "No active bill found. Please start a bill first.";
        deps.speak?.(noBillMsg);
        deps.appendAssistantMessage?.(noBillMsg);
        return;
      }

      // ✅ Open payment popup immediately with no mobile/wallet yet
      _openPayment(deps, undefined, { applyWallet: false });

      (window as any).conversationState = 'WAITING_FOR_MOBILE_CONSENT';
      const consentMsg = "Would you like to provide your mobile number? If you do, a discount will be credited to your wallet. Say yes or no.";
      deps.speak?.(consentMsg);
      deps.appendAssistantMessage?.(consentMsg);
      return;
    }

    // ── ADD_ITEM intent ──────────────────────────────────────────────────────
    if (act === 'ADD_ITEM' || candStr.includes('add')) {
      try {
        if (!deps.billId) {
          const autoBillMsg = "Starting a new bill first. Please wait.";
          deps.speak?.(autoBillMsg);
          deps.appendAssistantMessage?.(autoBillMsg);

          await deps.handleStartBilling();

          let attempts = 0;
          while (!deps.billId && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 300));
            attempts++;
          }

          await new Promise(resolve => setTimeout(resolve, 400));
        }

        let productName = String(payload?.productName || '').trim();
        if (!productName && candStr.includes('atta')) productName = 'Atta';

        if (!productName && !payload.productSku) {
          const warnMsg = "No product target specified.";
          deps.speak?.(warnMsg);
          deps.appendAssistantMessage?.(warnMsg);
          return;
        }

        const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nLanguage') : null;
        const lang = String(payload?.language || payload?.lang || storedLang || i18n?.language || 'en').trim();

        const inventorySearchPayload = {
          intent: "ADD_ITEM",
          productName: productName,
          qty: payload?.qty !== undefined ? Number(payload.qty) : undefined,
          unit: String(payload?.unit || 'kg'),
          brand: payload?.brand || null,
          language: lang,
          isLoose: payload.isLoose !== undefined ? payload.isLoose : null,
          productSku: payload.productSku || null
        };

        console.log("Calling inventory search API with payload:", inventorySearchPayload);
        const resp = await api.post('/inventory/search', inventorySearchPayload);
        const json = resp.data;

        if ((json?.multipleBrands === true || json?.multiBrand === true) && currentContextState !== 'WAITING_FOR_BRAND_SELECTION') {
          const candidatesList: BrandCandidate[] = json.candidates || [];

          pendingBrandState = {
            originalRequest: {
              ...payload,
              intent: 'ADD_ITEM',
              productName,
              qty: payload?.qty !== undefined ? Number(payload.qty) : undefined,
              unit: String(payload?.unit || 'kg')
            },
            candidates: candidatesList
          };

          (window as any).conversationState = 'WAITING_FOR_BRAND_SELECTION';

          const uniqueBrandsArray = Array.from(new Set(candidatesList.map(c => c.brand.trim())));
          const humanBrands = uniqueBrandsArray.map((brand, index) => `${index + 1}. ${brand}`).join(', ');
          const prompt = `Multiple brands found. ${humanBrands}. Which brand do you want?`;

          deps.speak?.(prompt);
          deps.appendAssistantMessage?.(prompt);
          return;
        }

        if (json?.needsPackagingClarification === true) {
          pendingRequestState = {
            ...payload,
            intent: 'ADD_ITEM',
            productName,
            qty: payload?.qty !== undefined ? Number(payload.qty) : undefined,
            unit: String(payload?.unit || 'kg'),
            language: lang
          };
          (window as any).conversationState = 'WAITING_FOR_PACKAGING';
          const packagingPrompt = json.prompt || "Do you want loose or packet?";
          deps.speak?.(packagingPrompt);
          deps.appendAssistantMessage?.(packagingPrompt);
          return;
        }

        if (json?.error) {
          const errorMsg = json.error || "An error occurred while searching for the product.";
          deps.speak?.(errorMsg);
          deps.appendAssistantMessage?.(errorMsg);
          return;
        }

        let items: any[] = json.candidates || (json.candidate ? [json.candidate] : []);
        if (items.length === 0) {
          deps.speak?.(`No items found matching ${productName}.`);
          return;
        }

        const product = items[0];
        const finalCartQty = Number(json?.checkoutQty) || Number(payload?.qty) || 5;

        let selectedBatchNo = "BATCH-DEFAULT-01";
        const pid = product.productId ?? product.id;

        if (pid) {
          try {
            const batchResp = await api.get('/inventory/batches', { params: { productId: pid } });
            if (Array.isArray(batchResp.data) && batchResp.data.length > 0) {
              selectedBatchNo = batchResp.data[0].batchNo || batchResp.data[0].id || selectedBatchNo;
            } else if (batchResp.data && batchResp.data.batchNo) {
              selectedBatchNo = batchResp.data.batchNo;
            }
          } catch (batchErr) {
            console.warn("Batch API mapping fallback resolution tracking used:", batchErr);
          }
        }

        const targetProductSource = product.product || product;
        const availableStock = Number(targetProductSource.totalQty ?? targetProductSource.avlQty ?? targetProductSource.availableQty ?? 0);
        const price = Number(targetProductSource.price);
        const discount = Number(targetProductSource.discountAmount);
        const mrp = Number(targetProductSource.mrp ?? price);

        const baseDiscountPerItem = discount;
        const grossAmount = price * finalCartQty;
        const totalDiscount = baseDiscountPerItem * finalCartQty;
        const netAmount = grossAmount - totalDiscount;

        const cartItems = [{
          productId: String(pid ?? targetProductSource.productId ?? targetProductSource.id ?? ''),
          batchNo: selectedBatchNo,
          name: product.productName ?? targetProductSource.productName ?? productName,
          sku: product.productSku ?? targetProductSource.productSku ?? '',
          qty: finalCartQty,

          avlQty: availableStock,
          availableQty: availableStock,
          stock: availableStock,
          totalQty: availableStock,
          quantity: finalCartQty,

          price: price,
          mrp: mrp,

          discount: baseDiscountPerItem,
          discountAmount: baseDiscountPerItem,

          total: netAmount,
          amount: netAmount,
          grossAmount: grossAmount,

          product: {
            ...targetProductSource,
            id: String(pid ?? targetProductSource.productId ?? targetProductSource.id ?? ''),
            avlQty: availableStock,
            availableQty: availableStock,
            stock: availableStock,
            totalQty: availableStock,
            price: price,
            mrp: mrp,
            discount: baseDiscountPerItem,
            discountAmount: baseDiscountPerItem
          }
        }];

        if (deps.addCartItems) {
          deps.addCartItems(cartItems);
          const localizedBrandText = payload.brand ? `${payload.brand} ` : '';
          const confirmationText = `Added ${finalCartQty} ${payload.unit || 'kg'} ${localizedBrandText}${productName || product.productName}.`;
          deps.speak?.(confirmationText);
          deps.appendAssistantMessage?.(confirmationText);
        }

        if (deps.playBeep) void deps.playBeep();
        return;
      } catch (e) {
        console.error(e);
      }
    }

    if (act === 'START_BILL' || /start\s*(a\s*)?bill/i.test(txt) || /naya bill/i.test(txt)) {
      if (!deps.billId) void deps.handleStartBilling();
      return;
    }
  } catch (e) {
    console.error('voiceIntentHandler internal exception:', e);
  }
}

// ─── private helpers ─────────────────────────────────────────────────────────

type PaymentOptions = {
  applyWallet?: boolean;
  walletBalance?: number;
};

function _openPayment(deps: VoiceDeps, mobileNumber?: string, options?: PaymentOptions) {
  if (deps.openPaymentModal) {
    deps.openPaymentModal(mobileNumber, options);
  } else {
    deps.setUnifiedModalTab('payment');
    deps.setShowUnifiedControlsModal(true);
  }
}

export default handleVoiceIntent;