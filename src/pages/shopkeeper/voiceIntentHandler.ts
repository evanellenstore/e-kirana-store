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
      const candidates = pendingBrandState.candidates;
      let selectedCandidate: BrandCandidate | null = null;

      const parsedIndex = parseInt(selectedBrandValue, 10);
      if (!isNaN(parsedIndex) && parsedIndex > 0 && parsedIndex <= candidates.length) {
        selectedCandidate = candidates[parsedIndex - 1];
      }

      if (!selectedCandidate) {
        selectedCandidate = candidates.find(c => {
          const splitTokens = c.brand.toLowerCase().split('-');
          return splitTokens.some(token => selectedBrandValue.toLowerCase().includes(token) || token.includes(selectedBrandValue.toLowerCase()));
        }) || null;
      }

      if (selectedCandidate) {
        payload = {
          ...pendingBrandState.originalRequest,
          intent: 'ADD_ITEM',
          productSku: selectedCandidate.productSku,
          brand: selectedCandidate.brand.split('-')[0].trim(),
          isLoose: payload.isLoose !== undefined ? payload.isLoose : pendingBrandState.originalRequest.isLoose
        };
        
        act = 'ADD_ITEM'; 
        pendingBrandState = null;
        (window as any).conversationState = 'IDLE';
      } else {
        const retryMsg = "Invalid brand selection. Please specify one of the available options.";
        deps.speak?.(retryMsg);
        deps.appendAssistantMessage?.(retryMsg);
        return;
      }
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
    // 3. MAIN SERVICE ROUTING PIPELINE TRACK
    // =========================================================================
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
          qty: Number(payload?.qty) || 1,
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
        if ((json?.multipleBrands === true || json?.multiBrand === true )) {
          const candidatesList: BrandCandidate[] = json.candidates || [];
          
          pendingBrandState = {
            originalRequest: { 
              ...payload,
              intent: 'ADD_ITEM', 
              productName, 
              qty: Number(payload?.qty) || 5, 
              unit: String(payload?.unit || 'kg') 
            },
            candidates: candidatesList
          };

          (window as any).conversationState = 'WAITING_FOR_BRAND_SELECTION';

          const uniqueBrandsArray = Array.from(
            new Set(candidatesList.map(c => c.brand.split('-')[0].trim()))
          );
          
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
            qty: Number(payload?.qty) || 5, 
            unit: String(payload?.unit || 'kg'), 
            language: lang 
          };
          (window as any).conversationState = 'WAITING_FOR_PACKAGING';
          const packagingPrompt = json.prompt || "Do you want loose or packet?";
          deps.speak?.(packagingPrompt);
          deps.appendAssistantMessage?.(packagingPrompt);
          return;
        }

        //=====================================================================
        if(json?.error) {
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

        // --- FIXED BATCH ENDPOINT TO USE ORIGINAL MAPPING ---
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

        // 🔥 DEEP SCHEMA TRACKING LOGGER WITH DYNAMIC FALLBACK MATCHING
console.log("Voice Assistant matching product object schema details:", product);

// 1. EXTRACT DATA DIRECTLY MATCHING YOUR API JSON RESPONSE STRUCTURE
const targetProductSource = product.product || product;

// Map 'totalQty' from your API to your stock keys
const availableStock = Number(targetProductSource.totalQty ?? targetProductSource.avlQty ?? targetProductSource.availableQty ?? 0);

// Map price and discount rules explicitly matching your payload
const price = Number(targetProductSource.price);
const discount = Number(targetProductSource.discountAmount);

// Use price directly as fallback if MRP is missing from candidate block
const mrp = Number(targetProductSource.mrp ?? price); 


// 2. CONSTRUCT THE STRICT TOTALS (Keep base metrics unmultiplied for the row fields)
const baseDiscountPerItem = discount; // 2.0 (Do NOT multiply by finalCartQty here)
const grossAmount = price * finalCartQty;
const totalDiscount = baseDiscountPerItem * finalCartQty; 
const netAmount = grossAmount - totalDiscount;

// 3. COMPLETE INTEGRATED CART SCHEMA
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
  
  // Financial Structure Fields
  price: price,
  mrp: mrp,
  
  // Pass the single-item discount value so your cart context can safely multiply it
  discount: baseDiscountPerItem, 
  discountAmount: baseDiscountPerItem, // Changed from totalDiscount to fix the double multiplication!
  
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

export default handleVoiceIntent;