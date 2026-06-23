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
  [k: string]: any;
};

export type VoiceDeps = {
  billId?: string | undefined;
  handleStartBilling: () => Promise<void> | void;
  setShowUnifiedControlsModal: (v: boolean) => void;
  setUnifiedModalTab: (t: 'payment' | 'inventory' | 'refund' | 'rewards' ) => void;
  setNotificationMessage: (m: string) => void;
  setNotificationType: (t: 'success' | 'danger' | 'warning' | 'info') => void;
  setShowNotification: (b: boolean) => void;
  t?: (k: string, opts?: any) => string;
  addCartItems?: (items: any[]) => void;
  playBeep?: () => Promise<void>;
  speak?: (text: string) => void;
  appendAssistantMessage?: (text: string) => void;
};

// Persistent context memory slice for managing conversation turn-arounds
let pendingRequestState: IntentPayload | null = null;

// Initialize global window state flag cleanly
if (typeof window !== 'undefined') {
  (window as any).isWaitingForPackaging = false;
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

export async function handleVoiceIntent(payload: IntentPayload, deps: VoiceDeps) {
  try {
    console.log('voiceIntentHandler received payload:', payload);

    // ==================================================
    // FIX: UNPACK NESTED / DOUBLE STRINGIFIED PAYLOAD JSON 
    // ==================================================
    try {
      if (typeof payload?.text === 'string') {
        const t = payload.text.trim();
        // Check if the text field contains a stringified JSON object
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed === 'object') {
            console.log('Flattening stringified payload text field values:', parsed);
            // Spread inner fields into the root payload object so fields like productName are accessible
            payload = { ...payload, ...parsed };
          }
        }
      }
    } catch (e) {
      console.warn("Payload normalizer failed parsing inner text string:", e);
    }

    let act = String(payload?.intent || payload?.action || '').trim().toLowerCase();
    let txt = String(payload?.text || payload?.message || payload?.command || '').trim().toLowerCase();
    const candStr = buildCandidateString(payload);

    // ==================================================
    // 1. UNIFIED CONVERSATION PIPELINE ROUTER (SECOND CALL / TURN-TWO CLARIFICATION)
    // ==================================================
    if (pendingRequestState) {
      console.log('Resolving confirmation turn via unified backend parameter state routing...');
      try {
        // Fix: Send ONLY the clean string command the intent endpoint demands
        const response = await api.post('/ai/intent', { command: txt }, {
          params: { sessionMode: 'CONFIRM_PACKAGING' }
        });

        let data = response.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch (e) {}
        }

        if (data && (data.isLoose === true || data.isLoose === false)) {
          // Re-combine saved first turn details with the new choice
          payload = {
            ...pendingRequestState,
            isLoose: data.isLoose
          };
          
          act = 'add_item';
          pendingRequestState = null; 
          (window as any).isWaitingForPackaging = false; // Reset block gate

          // Notice: No early return! Execution rolls over seamlessly to block 2 below.
        } else {
          const retryMsg = "I couldn't catch that preference. Please state loose or packet.";
          deps.speak?.(retryMsg);
          deps.appendAssistantMessage?.(retryMsg);
          return;
        }
      } catch (err) {
        console.error("Single endpoint clarification request failed:", err);
        pendingRequestState = null;
        (window as any).isWaitingForPackaging = false;
        return;
      }
    }

    // ==================================================
    // 2. ADD ITEM INVENTORY PIPELINE (FIRST CALL OR FALL-THROUGH RESOLUTION)
    // ==================================================
    if (act === 'add_item' || candStr.includes('add')) {
      console.log('Processing ADD_ITEM context workflow...');
      try {
        let productName = String(payload?.productName || '').trim();
        
        if (!productName && candStr.includes('atta')) {
          productName = 'Atta';
        } else if (!productName) {
          productName = String(payload?.text || payload?.message || '').replace(/add/i, '').trim();
        }

        if (!productName) {
          const warnMsg = "No product specified. Please try again.";
          deps.speak?.(warnMsg);
          deps.appendAssistantMessage?.(warnMsg);
          return;
        }

        const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nLanguage') : null;
        const lang = String(payload?.language || payload?.lang || storedLang || i18n?.language || '').trim();
        
        // Fix: Explicitly map a clean, sanitized payload to prevent nested formatting errors
        const inventorySearchPayload = {
          productName: productName,
          qty: Number(payload?.qty) || 5,
          unit: String(payload?.unit || 'kg'),
          language: lang,
          isLoose: payload.isLoose !== undefined ? payload.isLoose : null
        };

        const resp = await api.post('/inventory/search', inventorySearchPayload);
        const json = resp.data;

        if (json?.multiBrand === true || (json?.options && Array.isArray(json.options) && json.options.length > 1)) {
          const prompt = json.prompt || `Multiple brands found. Which brand do you want?`;
          deps.speak?.(prompt);
          deps.appendAssistantMessage?.(prompt);
          return;
        }

        // Conversational Branching (Turn on Confirmation Flag if required)
        if (json?.needsPackagingClarification === true) {
          pendingRequestState = {
            intent: 'ADD_ITEM',
            productName,
            qty: Number(payload?.qty) || 5,
            unit: String(payload?.unit || 'kg'),
            language: lang
          };

          (window as any).isWaitingForPackaging = true; // Turn ON verification block flag

          const packagingPrompt = json.prompt || "Do you want loose or packet?";
          deps.speak?.(packagingPrompt);
          deps.appendAssistantMessage?.(packagingPrompt);
          return;
        }

        if (json?.error) {
          const errMsg = `Error: ${json.error}`;
          deps.speak?.(errMsg);
          deps.appendAssistantMessage?.(errMsg);
          return;
        }

        let items: any[] = [];
        let finalCheckoutQty: number | null = null;

        if (json && typeof json === 'object' && !Array.isArray(json)) {
          if (json.multiBrand === false && json.candidate) {
            items = [json.candidate];
            finalCheckoutQty = Number(json.checkoutQty ?? json.candidate.targetCartQty) || null;
          } else if (json.candidates && Array.isArray(json.candidates)) {
            items = json.candidates;
          }
        } else if (Array.isArray(json)) {
          items = json;
        }

        if (items.length > 1) {
          const prompt = "Multiple options found. Please choose an exact packaging layout.";
          deps.speak?.(prompt);
          deps.appendAssistantMessage?.(prompt);
          return;
        }

        if (items.length === 0) {
          const notFoundMsg = `No items found matching ${productName} with the requested measurements.`;
          deps.speak?.(notFoundMsg);
          deps.appendAssistantMessage?.(notFoundMsg);
          return;
        }

        const product = items[0];
        const pid = String(product.productId ?? product.id ?? '');
        
        if (finalCheckoutQty === null || finalCheckoutQty <= 0) {
          finalCheckoutQty = Number(product.targetCartQty ?? payload?.qty) || 1;
        }

        let batches: any[] = [];
        try {
          const br = await api.get('/inventory/batches', { params: { productId: pid } });
          batches = br.data || [];
        } catch (e) {
          console.error("Failed fetching batches:", e);
        }

        if (!Array.isArray(batches) || batches.length === 0) {
          const noBatchMsg = 'No batch inventory available for this item.';
          deps.speak?.(noBatchMsg);
          deps.appendAssistantMessage?.(noBatchMsg);
          return;
        }

        const sorted = batches.slice().sort((a: any, b: any) => {
          const availA = a.availableQty ?? 0;
          const availB = b.availableQty ?? 0;
          if ((availA > 0) !== (availB > 0)) return availB - availA;
          const da = new Date(a.expiryDate ?? a.expiry ?? 0).getTime() || 0;
          const db = new Date(b.expiryDate ?? b.expiry ?? 0).getTime() || 0;
          return da - db;
        });

        let remaining = Math.max(0, Math.floor(finalCheckoutQty));
        const allocations: any[] = [];
        for (const b of sorted) {
          if (remaining <= 0) break;
          const avail = b.availableQty ?? 0;
          const take = Math.min(avail > 0 ? avail : remaining, remaining);
          if (take <= 0) continue;
          allocations.push({ batchNo: b.batchNo ?? String(b.id ?? ''), qty: take, availableQty: avail, expiryDate: b.expiryDate ?? b.expiry });
          remaining -= take;
        }

        const cartItems = allocations.map(a => ({
          productId: pid,
          batchNo: a.batchNo,
          name: product.productName ?? product.name ?? '',
          sku: product.productSku ?? product.sku ?? '',
          price: product.price ?? 0,
          discountAmount: product.discountAmount ?? 0,
          qty: a.qty,
          availableQty: a.availableQty,
          expiryDate: (typeof a.expiryDate === 'string') ? a.expiryDate : (a.expiryDate ? new Date(a.expiryDate).toISOString() : '')
        }));

        if (cartItems.length === 0) {
          const errAlloc = "Could not allocate stock inventory quantity.";
          deps.speak?.(errAlloc);
          deps.appendAssistantMessage?.(errAlloc);
          return;
        }

        if (deps.addCartItems) {
          deps.addCartItems(cartItems);
          const productLabel = product.productName || product.name || productName;
          const packagingSuffix = product.isLoose ? `${json.requestedUnit || 'units'}` : 'packet(s)';
          const confirmationText = `Added ${finalCheckoutQty} ${packagingSuffix} of ${productLabel} to your cart.`;
          
          deps.speak?.(confirmationText);
          deps.appendAssistantMessage?.(confirmationText);
        }

        if (deps.playBeep) { try { await deps.playBeep(); } catch {} }
        return;
      } catch (e) {
        const failMsg = "Failed to add item via voice control context.";
        deps.speak?.(failMsg);
        deps.appendAssistantMessage?.(failMsg);
        return;
      }
    }

    // ==================================================
    // 3. ALTERNATIVE ACTIONS
    // ==================================================
    if (act === 'start_bill' || act === 'startbilling' || /start\s*(a\s*)?bill/i.test(txt) || /naya bill/i.test(txt)) {
      if (!deps.billId) {
        void deps.handleStartBilling();
        const startMsg = "New billing transaction document established.";
        deps.speak?.(startMsg);
        deps.appendAssistantMessage?.(startMsg);
      } else {
        const msg = deps.t ? deps.t('billing.alreadyStarted') : 'Bill has already been initialized.';
        deps.speak?.(msg);
        deps.appendAssistantMessage?.(msg);
      }
      return;
    }

    if (act === 'close_billing_control' || act === 'close_billing_controls') {
      deps.setShowUnifiedControlsModal(false);
      return;
    }

    if (act === 'open_billing_control' || act === 'open_billing_controls') {
      const tab = String(payload?.tab || '').toLowerCase();
      deps.setUnifiedModalTab((tab === 'payment' || tab === 'refund' || tab === 'inventory' || tab === 'rewards') ? tab : 'inventory');
      deps.setShowUnifiedControlsModal(true);
      return;
    }

    if (txt || candStr) {
      const message = txt || candStr;
      deps.speak?.(message);
      deps.appendAssistantMessage?.(message);
    }
  } catch (e) {
    console.error('voiceIntentHandler internal exception:', e);
  }
}

export default handleVoiceIntent;