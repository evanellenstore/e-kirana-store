// voice intent handler (no React types required here)
import api from '../../services/api';

export type IntentPayload = {
  intent?: any;
  action?: any;
  text?: any;
  message?: any;
  command?: any;
  [k: string]: any;
};


//==============================
/*
export type VoiceDeps = {
  billId?: string | undefined;
  handleStartBilling: () => Promise<void> | void;
  setShowUnifiedControlsModal: (v: boolean) => void;
  setUnifiedModalTab: (t: 'payment' | 'inventory' | 'refund' | 'rewards') => void;
  setNotificationMessage: (m: string) => void;
  setNotificationType: (t: 'success' | 'danger' | 'warning' | 'info' ) => void;
  setShowNotification: (b: boolean) => void;
  t?: (k: string, opts?: any) => string;
  // Fetch batches for a productId: (productId, requiredQty) => Promise<batch[]>
  fetchBatches?: (productId: string, requiredQty: number) => Promise<any[]>;
  // Add items to cart: accepts array of cart-like items
  addCartItems?: (items: any[]) => void;
  // Optional: play feedback beep
  playBeep?: () => Promise<void>;
};
*/

export type VoiceDeps = {
  billId?: string | undefined;
  handleStartBilling: () => Promise<void> | void;
  setShowUnifiedControlsModal: (v: boolean) => void;
  setUnifiedModalTab: (
    t: 'payment' | 'inventory' | 'refund' | 'rewards'
  ) => void;

  setNotificationMessage: (m: string) => void;
  setNotificationType: (
    t: 'success' | 'danger' | 'warning' | 'info'
  ) => void;

  setShowNotification: (b: boolean) => void;

  t?: (k: string, opts?: any) => string;

  fetchBatches?: (
    productId: string,
    requiredQty: number
  ) => Promise<any[]>;

  addCartItems?: (items: any[]) => void;

  playBeep?: () => Promise<void>;

  // ADD THIS
  speak?: (text: string) => void;
};



//==================================================
// Build candidate string from payload
function buildCandidateString(payload: IntentPayload) {
  const parts: string[] = [];

  try {
    if (payload?.intent) {
      parts.push(String(payload.intent));
    }

    if (typeof payload?.intent === 'object' && payload.intent?.name) {
      parts.push(String(payload.intent.name));
    }
  } catch {}

  try {
    if (payload?.action) {
      parts.push(String(payload.action));
    }
  } catch {}

  try {
    if (payload?.text) {
      parts.push(String(payload.text));
    }
  } catch {}

  try {
    if (payload?.message) {
      parts.push(String(payload.message));
    }
  } catch {}

  try {
    if (payload?.command) {
      parts.push(String(payload.command));
    }
  } catch {}

  return parts.join(' ').toLowerCase();
}

// (removed unused helper collectStringValues)

export async function handleVoiceIntent(payload: IntentPayload,deps: VoiceDeps) {
  try {
    console.log( 'voiceIntentHandler received payload:',payload);
    const act = String(payload?.intent || payload?.action || '').trim().toLowerCase();
    const txt = String(payload?.text || payload?.message || payload?.command || '').trim().toLowerCase();
    const candStr = buildCandidateString(payload);
    // flattened values for potential use
    // const flatValues = collectStringValues(payload).map(String).join(' ').toLowerCase();
    console.log('ACT:', act);
    console.log('TXT:', txt);
    console.log('CANDIDATE:', candStr);


    // ==================================================
    // ADD ITEM (voice intent)
    // payload example: { intent: 'ADD_ITEM',productSKU: 'FORTUN-MUSTAR-1-LIT-8CBBD2', product: 'mustard oil', quantity: 1, unit: 'litre' }
    // ==================================================
    if (String(payload?.intent || '').toLowerCase() === 'add_item' ||String(payload?.action || '').toLowerCase() === 'add_item') {
      console.log('ADD_ITEM intent matched');
      try {
        const productName = String(payload?.product || payload?.text || payload?.message || '').trim();
        const qty = Number(payload?.quantity ?? payload?.qty ?? 1) || 1;
        //adding waring for missing product name
        if (!productName) {
          deps.setNotificationMessage('No product specified');
          deps.setNotificationType('warning');
          deps.setShowNotification(true);
          setTimeout(() => deps.setShowNotification(false), 3000);
          return;
        }

            
          console.debug('voiceIntent: searching inventory for', productName);
            
            // calling inventory search API
            const resp = await api.get('/inventory/search', { params: { name: productName } });
            const json = resp.data;
            const items = Array.isArray(json) ? json : (json?.results || []);
      
        // Check if any items not found then show notification and return   
        if (!items || items.length === 0) {
          deps.setNotificationMessage('Product not found');
          deps.setNotificationType('info');
          deps.setShowNotification(true);
          setTimeout(() => deps.setShowNotification(false), 3000);
          return;
        }

        // Use the first matching product for allocation
        const product = items[0];
        const pid = String(product.productId ?? product.id ?? '');
        // fetch batches via provided dep if available, else try a default endpoint
        let batches: any[] = [];
        if (deps.fetchBatches) {
          try { batches = await deps.fetchBatches(pid, qty); } catch (e) { console.warn('fetchBatches failed', e); }
        }

        
        if (!batches || batches.length === 0) {
          //calling inventory batch api call
          try {
            const br = await api.get('/inventory/batches', { params: { productId: pid } });
            batches = br.data || [];
          } catch (e) { console.warn('fallback batches fetch failed', e); }
        }

        if (!Array.isArray(batches) || batches.length === 0) {
          deps.setNotificationMessage('No batch data available');
          deps.setNotificationType('warning');
          deps.setShowNotification(true);
          setTimeout(() => deps.setShowNotification(false), 3000);
          return;
        }

        // allocate across earliest-expiry with availableQty
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

        
        // Build cart items
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
          deps.setNotificationMessage('Could not allocate any quantity');
          deps.setNotificationType('warning');
          deps.setShowNotification(true);
          setTimeout(() => deps.setShowNotification(false), 3000);
          return;
        }

        alert('product is added ');
        if (deps.addCartItems) {
          deps.addCartItems(cartItems);
         
          const productLabel =product.productName ||product.name || productName;
          deps.speak?.(`Added ${qty} ${productLabel}`);
        }

        if (deps.playBeep) {
          try { await deps.playBeep(); } catch {}
        }

        if (remaining > 0) {
          deps.setNotificationMessage(`Only ${qty - remaining} of ${qty} allocated`);
          deps.setNotificationType('warning');
          deps.setShowNotification(true);
          setTimeout(() => deps.setShowNotification(false), 4000);
        }

        return;
      } catch (e) {
        console.error('ADD_ITEM handling failed', e);
        deps.setNotificationMessage('Failed to add product');
        deps.setNotificationType('danger');
        deps.setShowNotification(true);
        setTimeout(() => deps.setShowNotification(false), 3000);
        return;
      }
    }
    // ==================================================

    // ==================================================
    // START BILL
    // ==================================================
    if (
      act === 'start_bill' ||
      act === 'startbilling' ||
      act === 'createbill' ||
      act === 'create_bill' ||
      /start\s*(a\s*)?bill/i.test(txt) ||
      /start billing/i.test(txt) ||
      /naya bill/i.test(txt)
    ) {
      console.log('START BILL MATCHED');

      if (!deps.billId) {
        void deps.handleStartBilling();
      } else {
        const msg = deps.t
          ? deps.t('billing.alreadyStarted')
          : 'Bill already started';

        deps.setNotificationMessage(msg);
        deps.setNotificationType('info');
        deps.setShowNotification(true);

        setTimeout(() => {
          deps.setShowNotification(false);
        }, 3000);
      }

      return;
    }

    // ==================================================
    // CLOSE BILLING CONTROL
    // CHECK BEFORE OPEN
    // ==================================================
    if (
      act === 'close_billing_control' ||
      act === 'close_billing_controls' ) {
      console.log('CLOSE BILLING CONTROL MATCHED');

      deps.setShowUnifiedControlsModal(false);

      deps.setNotificationMessage(
        'Billing controls closed'
      );
      deps.setNotificationType('success');
      deps.setShowNotification(true);

      setTimeout(() => {
        deps.setShowNotification(false);
      }, 2000);

      return;
    }

    // ==================================================
    // OPEN BILLING CONTROL
    // ==================================================
    if (
      act === 'open_billing_control' || act === 'open_billing_controls' ) {
      console.log(
        'OPEN BILLING CONTROL MATCHED'
      );

      const tab = String(
        payload?.tab || ''
      ).toLowerCase();

      if (
        tab === 'payment' ||
        tab === 'refund' ||
        tab === 'inventory' ||
        tab === 'rewards'
      ) {
        deps.setUnifiedModalTab(tab as any);
      } else {
        deps.setUnifiedModalTab('inventory');
      }

      deps.setShowUnifiedControlsModal(true);

      return;
    }

    // ==================================================
    // FALLBACK
    // ==================================================
    if (txt || candStr) {
      const message = txt || candStr;

      deps.setNotificationMessage(
        message.length > 120
          ? `${message.slice(0, 120)}...`
          : message
      );

      deps.setNotificationType('info');
      deps.setShowNotification(true);

      setTimeout(() => {
        deps.setShowNotification(false);
      }, 4000);
    }
  } catch (e) {
    console.error(
      'voiceIntentHandler error:',
      e
    );
  }
}

export default handleVoiceIntent;

// Expose for quick testing from browser console
try {
  if (typeof window !== 'undefined') (window as any).handleVoiceIntent = handleVoiceIntent;
} catch {}