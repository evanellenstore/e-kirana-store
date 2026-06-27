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
  // Payment popup opener — receives optional mobile number
  openPaymentModal?: (mobileNumber?: string) => void;
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

/** Returns true when a raw transcript looks like a 10-digit mobile number */
function extractMobileNumber(text: string): string | null {
  const digits = text.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  // handle "nine eight..." spoken-digit strings fallback — skip for now
  return null;
}

/** Detect affirmative / negative from user speech */
function isAffirmative(text: string): boolean {
  return /\b(yes|yeah|yep|haan|ha|sure|ok|okay|provide|give)\b/i.test(text);
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
    const candStr = buildCandidateString(payload);

    const currentContextState = (window as any).conversationState || 'IDLE';

    // =========================================================================
    // 1. CONTEXT RESOLUTION: BRAND_SELECTION (Processing Response From Turn 2)
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_BRAND_SELECTION' && pendingBrandState) {
      const selectedBrandValue = (payload.brand || txt || '').trim();
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
    // 2. CONTEXT RESOLUTION: CONFIRM_PACKAGING
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
    // 3. CONTEXT RESOLUTION: PAYMENT — WAITING FOR MOBILE NUMBER CONSENT
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_MOBILE_CONSENT') {
      if (isAffirmative(txt)) {
        // User wants to provide mobile — ask for it
        (window as any).conversationState = 'WAITING_FOR_MOBILE_NUMBER';
        const askMsg = "Please tell me your 10-digit mobile number.";
        deps.speak?.(askMsg);
        deps.appendAssistantMessage?.(askMsg);
        return;
      } else if (isNegative(txt)) {
        // Skip mobile — open payment modal without number
        (window as any).conversationState = 'IDLE';
        const proceedMsg = "Proceeding to payment without a mobile number.";
        deps.speak?.(proceedMsg);
        deps.appendAssistantMessage?.(proceedMsg);
        _openPayment(deps, undefined);
        return;
      } else {
        // Unclear — re-prompt
        const retryMsg = "Please say yes to provide your mobile number, or no to skip.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 4. CONTEXT RESOLUTION: PAYMENT — WAITING FOR MOBILE NUMBER DIGITS
    // =========================================================================
    if (currentContextState === 'WAITING_FOR_MOBILE_NUMBER') {
      const mobile = extractMobileNumber(txt);
      if (mobile) {
        (window as any).conversationState = 'IDLE';
        const confirmMsg = `Got it! Mobile number ${mobile} saved. A discount will be credited to your wallet. Opening payment now.`;
        deps.speak?.(confirmMsg);
        deps.appendAssistantMessage?.(confirmMsg);
        _openPayment(deps, mobile);
        return;
      } else {
        // Could not parse a 10-digit number
        const retryMsg = "I didn't catch that. Please say your 10-digit mobile number clearly.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
    }

    // =========================================================================
    // 5. MAIN SERVICE ROUTING PIPELINE TRACK
    // =========================================================================

    // ── PAYMENT intent ───────────────────────────────────────────────────────
    const isPaymentIntent =
      act === 'PAYMENT' ||
      act === 'TAKE_PAYMENT' ||
      act === 'PAY' ||
      /\b(payment|pay|checkout|bill\s*pay|bhugtan)\b/i.test(candStr);

    if (isPaymentIntent) {
      if (!deps.billId) {
        const noBillMsg = "No active bill found. Please start a bill first.";
        deps.speak?.(noBillMsg);
        deps.appendAssistantMessage?.(noBillMsg);
        return;
      }

      // Enter multi-turn: ask for mobile consent
      (window as any).conversationState = 'WAITING_FOR_MOBILE_CONSENT';
      const consentMsg =
        "Would you like to provide your mobile number? If you do, a discount will be credited to your wallet. Say yes or no.";
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

        //===================================================================================
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
        //===================================================================================
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
            console.log(`Calling original batches API via query string parameter for productId: ${pid}`);
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

        console.log("Voice Assistant matching product object schema details:", product);

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

/**
 * Opens the payment modal. If `openPaymentModal` is provided on deps, calls it
 * (passes optional mobile number). Falls back to the unified controls modal.
 */
function _openPayment(deps: VoiceDeps, mobileNumber?: string) {
  if (deps.openPaymentModal) {
    deps.openPaymentModal(mobileNumber);
  } else {
    deps.setUnifiedModalTab('payment');
    deps.setShowUnifiedControlsModal(true);
  }
}

export default handleVoiceIntent;