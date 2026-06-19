import api from '../../services/api';
import i18n from '../../i18n/config';

export type IntentPayload = {
  intent?: any;
  action?: any;
  text?: any;
  message?: any;
  command?: any;
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
  fetchBatches?: (productId: string, requiredQty: number ) => Promise<any[]>;
  addCartItems?: (items: any[]) => void;
  playBeep?: () => Promise<void>;
  speak?: (text: string) => void;
  appendAssistantMessage?: (text: string) => void; // Essential Left-Log connector
};

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

    try {
      if (typeof payload?.text === 'string') {
        const t = payload.text.trim();
        if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) {
          const parsed = JSON.parse(t);
          if (parsed && typeof parsed === 'object') {
            payload = { ...(payload as any), ...parsed };
          }
        }
      }
    } catch (e) {}

    const act = String(payload?.intent || payload?.action || '').trim().toLowerCase();
    const txt = String(payload?.text || payload?.message || payload?.command || '').trim().toLowerCase();
    const candStr = buildCandidateString(payload);

    // ==================================================
    // ADD ITEM INTENT MATCHING ENGINE
    // ==================================================
    if (act === 'add_item' || candStr.includes('add')) {
      console.log('ADD_ITEM intent matched');
      try {
        let productName = String(payload?.productName || '').trim();
        
        // Conversational phrase structure mapping fallback
        if (!productName && candStr.includes('atta')) {
          productName = 'Atta';
        } else if (!productName) {
          productName = String(payload?.text || payload?.message || '').replace(/add/i, '').trim();
        }

        const qty = Number(payload?.qty ?? 5) || 5;

        if (!productName) {
          const warnMsg = "No product specified. Please try again.";
          deps.speak?.(warnMsg);
          deps.appendAssistantMessage?.(warnMsg);
          return;
        }

        console.debug('voiceIntent: searching inventory for', productName);

        const storedLang = typeof localStorage !== 'undefined' ? localStorage.getItem('i18nLanguage') : null;
        const lang = String(payload?.language || payload?.lang || storedLang || i18n?.language || '').trim();
        
        const resp = await api.post('/inventory/search', { ...payload, productName, language: lang });
        const json = resp.data;

        let items: any[] = [];
        if (Array.isArray(json)) items = json;
        else if (json?.results && Array.isArray(json.results)) items = json.results;
        else if (json?.candidates && Array.isArray(json.candidates)) {
          items = json.candidates;
          payload.candidates = json.candidates;
          payload.options = payload.options || json.options;
          payload.prompt = payload.prompt || json.prompt;
        } else if (json?.candidate && typeof json.candidate === 'object') {
          items = [json.candidate];
          payload.candidate = json.candidate;
        }

        if (payload?.candidates && Array.isArray(payload.candidates) && payload.candidates.length > 1) {
          const opts = payload.options && Array.isArray(payload.options) ? payload.options : payload.candidates.map((c: any) => c.brand || c.productName || c.name || String(c));
          const prompt = payload.prompt || `Multiple brands found: ${opts.map((o: any, i: number) => `${i + 1}. ${o}`).join(', ')}. Which brand do you want?`;
          deps.speak?.(prompt);
          deps.appendAssistantMessage?.(prompt);
          return;
        }

        if (payload?.candidate && typeof payload.candidate === 'object') {
          items.splice(0, items.length, payload.candidate);
        }

        if (!items || items.length === 0) {
          const notFoundMsg = `No product with name ${productName} found. Please try again.`;
          deps.speak?.(notFoundMsg);
          deps.appendAssistantMessage?.(notFoundMsg);
          return;
        }

        const product = items[0];
        const pid = String(product.productId ?? product.id ?? '');
        let batches: any[] = [];
        
        if (deps.fetchBatches) {
          try { batches = await deps.fetchBatches(pid, qty); } catch (e) {}
        }

        if (!batches || batches.length === 0) {
          try {
            const br = await api.get('/inventory/batches', { params: { productId: pid } });
            batches = br.data || [];
          } catch (e) {}
        }

        if (!Array.isArray(batches) || batches.length === 0) {
          const noBatchMsg = 'No batch data available for this product item.';
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

        let remaining = Math.max(0, Math.floor(qty));
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
          name: product.name ?? product.title ?? product.productName ?? '',
          sku: product.productSku ?? product.skuCode ?? '',
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
          
          // CRITICAL OUTPUT: Formats execution log and renders on the Assistant layout console's LEFT side
          const confirmationText = `Added ${qty} kg ${productLabel} to your cart.`;
          deps.speak?.(confirmationText);
          deps.appendAssistantMessage?.(confirmationText);
        }

        if (deps.playBeep) { try { await deps.playBeep(); } catch {} }

        if (remaining > 0) {
          const partialMsg = `Only ${qty - remaining} of ${qty} allocated due to shortages.`;
          deps.speak?.(partialMsg);
          deps.appendAssistantMessage?.(partialMsg);
        }
        return;
      } catch (e) {
        const failMsg = "Failed to append item selection through vocal parsing.";
        deps.speak?.(failMsg);
        deps.appendAssistantMessage?.(failMsg);
        return;
      }
    }

    // ==================================================
    // START BILL CONTROLS
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

    // ==================================================
    // MODAL WINDOW INTERFACE WRAPPERS
    // ==================================================
    if (act === 'close_billing_control' || act === 'close_billing_controls') {
      deps.setShowUnifiedControlsModal(false);
      const closeMsg = "Unified terminal dashboard panel closed.";
      deps.speak?.(closeMsg);
      deps.appendAssistantMessage?.(closeMsg);
      return;
    }

    if (act === 'open_billing_control' || act === 'open_billing_controls') {
      const tab = String(payload?.tab || '').toLowerCase();
      if (tab === 'payment' || tab === 'refund' || tab === 'inventory' || tab === 'rewards') {
        deps.setUnifiedModalTab(tab as any);
      } else {
        deps.setUnifiedModalTab('inventory');
      }
      deps.setShowUnifiedControlsModal(true);
      const openMsg = `Dashboard panel updated to displaying ${tab || 'inventory'} views.`;
      deps.speak?.(openMsg);
      deps.appendAssistantMessage?.(openMsg);
      return;
    }

    // Default general fallback parsing execution
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