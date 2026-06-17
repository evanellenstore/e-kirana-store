import { useContext, useEffect, useRef, useState } from "react";
import {
  Container,
  InputGroup,
  Form,
  Button,
  Table,
  Row,
  Col,
  Badge,
  Modal,
  Alert
} from "react-bootstrap";
import ShopkeeperHeader from "../../components/ShopkeeperHeader";
import VoiceAssistant from "../../components/VoiceAssistant";
import importedHandleVoiceIntent from "./voiceIntentHandler";
import {
  startBill,
  getProductBySku,
  getBatches as getBatchesRaw,
  getBatchesCached as getBatches,
  getBatchesDebounced,
  addItemsBatch,
  finalizeBill,
  cancelBill,
  getSummary,
  checkBillRefundStatus,
  markBillAsRefunded,
  type CartItem
} from "../../services/billingApi";
import {
  getOrCreateCustomer,
  getCustomerByMobile,
  addToWallet,
  deductFromWallet,
  getWalletTransactions,
  getWalletTransactionsPaginated,
  getBillingTransactions,
  getBillingTransactionsPaginated,
  type Customer,
  type WalletTransaction,
  type PaginatedResponse
} from "../../services/customerApi";
import {
  getReservedItems,
  releaseInventory,
  adjustInventory,
  type ReservedItem
} from "../../services/inventoryService";

import { AuthContext } from "../../auth/AuthContext";
import { useTranslation } from "react-i18next";
import "./Billing.css";

const Billing = () => {
  const { t } = useTranslation();
  console.log("Billing component mounted");
  const [billId, setBillId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subtotalBeforeDiscount, setSubtotalBeforeDiscount] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [reservedForBill, setReservedForBill] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [discountIsPercent, setDiscountIsPercent] = useState<boolean>(false);
  const [gstRate] = useState<number>(0);
  const [notificationMessage, setNotificationMessage] = useState<string>("");
  const [notificationType, setNotificationType] = useState<"success" | "danger" | "warning" | "info">("info");
  const [showNotification, setShowNotification] = useState(false);
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [cashReceived, setCashReceived] = useState<number | undefined>(undefined);
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showRefundSlip, setShowRefundSlip] = useState(false);
  const [refundSlipData, setRefundSlipData] = useState<any>(null);
  const [useWallet, setUseWallet] = useState<boolean>(false);

  // Unified Controls Modal state
  const [showUnifiedControlsModal, setShowUnifiedControlsModal] = useState(false);
  const [unifiedModalTab, setUnifiedModalTab] = useState<"payment" | "inventory" | "refund" | "rewards">("payment");

  // Rewards state
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [billTransactions, setBillTransactions] = useState<any[]>([]);
  const [loadingRewards, setLoadingRewards] = useState(false);
  const [rewardsSearchMobile, setRewardsSearchMobile] = useState<string>("");
  const [rewardsSearchedCustomer, setRewardsSearchedCustomer] = useState<Customer | null>(null);
  const [rewardsSearchError, setRewardsSearchError] = useState<string | null>(null);

  // Wallet Transactions Pagination state
  const [walletCurrentPage, setWalletCurrentPage] = useState<number>(0);
  const [walletPageSize] = useState<number>(10);
  const [walletTotalPages, setWalletTotalPages] = useState<number>(0);
  const [walletTotalElements, setWalletTotalElements] = useState<number>(0);

  // Billing History Pagination state
  const [billCurrentPage, setBillCurrentPage] = useState<number>(0);
  const [billPageSize] = useState<number>(10);
  const [billTotalPages, setBillTotalPages] = useState<number>(0);
  const [billTotalElements, setBillTotalElements] = useState<number>(0);

  // Bill Details Modal state
  const [showBillDetailsModal, setShowBillDetailsModal] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string | null>(null);
  const [selectedBillDate, setSelectedBillDate] = useState<string | null>(null);
  const [billItems, setBillItems] = useState<any[]>([]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [billSubTotal, setBillSubTotal] = useState<number>(0);
  const [billTaxAmount, setBillTaxAmount] = useState<number>(0);
  const [billTotalAmount, setBillTotalAmount] = useState<number>(0);
  const [loadingBillDetails, setLoadingBillDetails] = useState(false);
  const [billRefunded, setBillRefunded] = useState(false);

  // Release/Refund state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [reservedItems, setReservedItems] = useState<ReservedItem[]>([]);
  const [loadingReserved, setLoadingReserved] = useState(false);
  const [selectedReservedItem, setSelectedReservedItem] = useState<ReservedItem | null>(null);
  const [releaseQty, setReleaseQty] = useState<number>(1);
  const [isReleasing, setIsReleasing] = useState(false);

  // Refund Search state
  const [refundSearchMobile, setRefundSearchMobile] = useState<string>("");
  const [refundSearchBillId, setRefundSearchBillId] = useState<string>("");
  const [refundSearchResults, setRefundSearchResults] = useState<any[]>([]);
  const [loadingRefundSearch, setLoadingRefundSearch] = useState(false);
  const [selectedRefundBill, setSelectedRefundBill] = useState<any>(null);
  const [refundSearchError, setRefundSearchError] = useState<string | null>(null);
  const [refundedMap, setRefundedMap] = useState<Record<string, boolean>>({});

  // Server-side pagination state for refund search results
  const [refundPage, setRefundPage] = useState<number>(0);
  const [refundPageSize] = useState<number>(5);
  const [refundTotalPages, setRefundTotalPages] = useState<number>(0);
  const [refundTotalElements, setRefundTotalElements] = useState<number>(0);

  // Return Item state
  const [showReturnItemModal, setShowReturnItemModal] = useState(false);
  const [returnItemSelection, setReturnItemSelection] = useState<{ [key: number]: number }>({});
  const [processingReturn, setProcessingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);

  // Payment Method Dialog for return
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [paymentMethodType, setPaymentMethodType] = useState<'cash' | 'wallet' | 'mixed'>('cash');
  const [walletAmountUsed, setWalletAmountUsed] = useState<number>(0);
  const [walletAmountInput, setWalletAmountInput] = useState<string>("");
  const [discountReversalOption, setDiscountReversalOption] = useState<'yes' | 'no'>('yes');
  // fetched bill summary from API for refunds
  const [fetchedBillSummary, setFetchedBillSummary] = useState<any>(null);
  const [allowManualPaymentMethodEdit, setAllowManualPaymentMethodEdit] = useState<boolean>(false);

  // Inventory Check Modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [showBarcodePreviewModal, setShowBarcodePreviewModal] = useState(false);
  const [filterLoadingDelay, setFilterLoadingDelay] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  // Batch allocation modal state (only used for Split action)
  const [showBatchAllocModal, setShowBatchAllocModal] = useState(false);
  const [batchOptions, setBatchOptions] = useState<any[]>([]);
  const [batchModalProduct, setBatchModalProduct] = useState<any | null>(null);
  const [batchModalOriginalIndex, setBatchModalOriginalIndex] = useState<number | null>(null);
  // allow selecting multiple batches via checkboxes and specify qty per selected batch
  const [batchModalSelectedBatches, setBatchModalSelectedBatches] = useState<string[]>([]);
  const [batchModalQtyMap, setBatchModalQtyMap] = useState<Record<string, number>>({});
  const [batchModalTotalQty, setBatchModalTotalQty] = useState<number>(1);
  
  // Multi-level filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);
  const filterDebounceRef = useRef<number | null>(null);
  // scanner buffer refs (capture fast keyboard input from USB barcode scanners)
  const scannerBufferRef = useRef<string>("");
  const scannerLastTimeRef = useRef<number | null>(null);
  const scannerTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false); // Prevent double scan

  const auth = useContext(AuthContext);

  // Helper to avoid floating point rounding issues: operate in paise (integer)
  const toPaise = (n: number) => Math.round((n || 0) * 100);
  const fromPaise = (p: number) => p / 100;

  /* =====================
     Start Bill
  ===================== */
  const handleStartBilling = async () => {
    try {
      const uname =
        auth?.user?.username ??
        (() => {
          const s = localStorage.getItem("user");
          if (!s) return "guest";
          try {
            return JSON.parse(s).username;
          } catch {
            return "guest";
          }
        })();

      console.log('Starting bill for user:', uname);
      const res = await startBill(uname);
      console.log('Bill started successfully:', res.data);
      setBillId(res.data.billId);
      setNotificationMessage(t('billing.newBillStarted', { billId: res.data.billId }));
      setNotificationType("success");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      barcodeRef.current?.focus();
    } catch (error: any) {
      console.error('Error starting bill:', error);
      console.error('Error details:', error.response?.data || error.message);
      setNotificationMessage(t('billing.failedStartBilling', { message: error.response?.data?.message || error.message || t('billing.unknownError') }));
      setNotificationType("danger");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    }
  };


//======================================================


  // Delegate to central handler
  const handleVoiceIntent = (payload: any) => {
    try {
      importedHandleVoiceIntent(payload, {
        billId,
        handleStartBilling,
        setShowUnifiedControlsModal,
        setUnifiedModalTab,
        setNotificationMessage,
        setNotificationType,
        setShowNotification,
        t,
      });
    } catch (e) {
      console.warn('delegate handleVoiceIntent failed', e);
    }
  };




//=======================================================



  // Handle going back to start billing screen
  const handleGoBackToBilling = () => {
    setCart([]);
    setDiscount(0);
    setDiscountIsPercent(false);
    setCashReceived(undefined);
    setCustomerMobile('');
    setReservedForBill(false);
    setSubtotalBeforeDiscount(0);
    setTotal(0);
    setBillId(undefined);
  };

  /* Keep focus on barcode input */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key;

      // If user is focused on an input/select/textarea (manual typing/interaction), don't intercept — let the element handle keys
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        const tag = active.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || active.isContentEditable) {
          return;
        }
      }

      const now = Date.now();

      if (k === "Enter") {
        // If we have accumulated buffer, process it
        const code = scannerBufferRef.current;
        scannerBufferRef.current = "";
        scannerLastTimeRef.current = null;
        if (code) {
          // dispatch to handler
          handleBarcode(code);
          e.preventDefault();
        }
        return;
      }

      if (k.length === 1) {
        // char
        const last = scannerLastTimeRef.current;
        if (last && now - last > 200) {
          // gap too big - treat as new sequence
          scannerBufferRef.current = k;
        } else {
          scannerBufferRef.current += k;
        }
        scannerLastTimeRef.current = now;

        // reset buffer after longer timeout if Enter never comes (2000ms for barcode scanners)
        if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
        scannerTimerRef.current = window.setTimeout(() => {
          const code = scannerBufferRef.current;
          scannerBufferRef.current = "";
          scannerLastTimeRef.current = null;
          scannerTimerRef.current = null;
          if (code) {
            handleBarcode(code);
          }
        }, 2000);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
    };
  }, []);

  /* =====================
     Handle Barcode (USB / Camera)
  ===================== */
  const handleBarcode = async (barcode: string) => {
    console.log("handleBarcode called", { barcode });
    if (!barcode.trim() || scanningRef.current) return;
    
    // Check if bill has been started
    if (!billId) {
      setNotificationMessage(t('billing.startBillPrompt'));
      setNotificationType("warning");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
      return;
    }

    scanningRef.current = true;

    try {
      const productRes = await getProductBySku(barcode.trim());
      const product = productRes.data || {};

      const pid = product.productId ?? product.id ?? product.sku ?? "";
      
      // Validate product ID
      if (!pid) {
        alert(t('billing.productNotFound'));
        return;
      }
      
  // Ask server for batches preferring ones that can satisfy qty=1
      const batchRes = await (getBatchesDebounced ? getBatchesDebounced(pid, 1) : getBatches(pid, 1));
      const batches = batchRes.data || [];

      // If multiple batches available, auto-select best batch (nearest expiry) and add 1 unit
      if (Array.isArray(batches) && batches.length > 1) {
        const availableBatches = batches.filter((b: any) => (b.availableQty ?? 0) > 0);
        const sortByExpiry = (a: any, b: any) => {
          const da = new Date(a.expiryDate ?? a.expiry ?? 0).getTime() || 0;
          const db = new Date(b.expiryDate ?? b.expiry ?? 0).getTime() || 0;
          return da - db;
        };
        const candidateList = availableBatches.length ? availableBatches : batches;
        const best = candidateList.slice().sort(sortByExpiry)[0] || batches[0];
        const batch = best;
        const batchNo = batch.batchNo ?? String(batch.id ?? "");

        // Add one unit by default for barcode scans
        setCart(prev => {
          const idx = prev.findIndex(i => i.productId === pid && i.batchNo === batchNo);
          if (idx !== -1) {
            const available = prev[idx].availableQty ?? 0;
            if (prev[idx].qty + 1 > available) {
              const ok = window.confirm(`Only ${available} unit(s) available in inventory. Add one more anyway?`);
              if (!ok) {
                alert(t('billing.notEnoughStock'));
                return prev;
              }
            }
            const copy = [...prev];
            copy[idx].qty += 1;
            return copy;
          }

          const availableQty = batch.availableQty ?? 0;
          if (availableQty <= 0) {
            const allow = window.confirm('Product not available in inventory. Add to cart anyway?');
            if (!allow) {
              alert(t('billing.productNotAdded'));
              return prev;
            }
          }

          return [
            ...prev,
            {
              productId: pid,
              batchNo: batchNo,
              name: product.name ?? product.title ?? "",
              sku: product.sku ?? product.skuCode ?? "",
              price: product.price ?? 0,
              discountAmount: product.discountAmount ?? 0,
              qty: 1,
              availableQty: availableQty,
              expiryDate: (typeof batch.expiryDate === 'string') ? batch.expiryDate : (batch.expiryDate ? new Date(batch.expiryDate).toISOString() : '')
            }
          ];
        });
        try { await playBeep(); } catch (e) { /* ignore */ }
        return;
      }

      const batch = batches[0]; // server returns suitable batches first

      // Check if batch data exists before proceeding
      if (!batch || !(batch.batchNo ?? batch.id)) {
        alert(t('billing.noBatchInfo'));
        return;
      }

      setCart(prev => {
        const batchNo = batch.batchNo ?? String(batch.id ?? "");
        const idx = prev.findIndex(i => i.productId === pid && i.batchNo === batchNo);

        if (idx !== -1) {
          const available = prev[idx].availableQty ?? 0;
          if (prev[idx].qty + 1 > available) {
            const ok = window.confirm(`Only ${available} unit(s) available in inventory. Add one more anyway?`);
            if (!ok) {
              alert(t('billing.notEnoughStock'));
              return prev;
            }
          }
          const copy = [...prev];
          copy[idx].qty += 1;
          return copy;
        }

        const availableQty = batch.availableQty ?? 0;
        if (availableQty <= 0) {
          const allow = window.confirm('Product not available in inventory. Add to cart anyway?');
          if (!allow) {
            alert(t('billing.productNotAdded'));
            return prev;
          }
        }

        return [
          ...prev,
          {
            productId: pid,
            batchNo: batchNo,
            name: product.name ?? product.title ?? "",
            sku: product.sku ?? product.skuCode ?? "",
            price: product.price ?? 0,
            discountAmount: product.discountAmount ?? 0,
            qty: 1,
            availableQty: availableQty,
            expiryDate: String(batch.expiryDate ?? ""),
          }
        ];
      });

      // Play beep for feedback (safe)
      try {
        await playBeep();
      } catch (beepErr) {
        console.warn('Beep failed', beepErr);
      }

      if (barcodeRef.current) barcodeRef.current.value = "";
    } catch (e) {
      console.error("Barcode error", e);
      alert(t('billing.productNotFound'));
    } finally {
      scanningRef.current = false;
    }
  };

  /* =====================
     Calculate Total
  ===================== */
  useEffect(() => {
    // Calculate subtotal before product discounts (original prices)
    const originalSubtotal = cart.reduce((s, i) => {
      return s + ((i.price ?? 0) * (i.qty ?? 0));
    }, 0);
    setSubtotalBeforeDiscount(originalSubtotal);
    
    // Calculate total: (price - discount) * qty for each item
    setTotal(cart.reduce((s, i) => {
      const priceAfterDiscount = Math.max(0, (i.price ?? 0) - (i.discountAmount ?? 0));
      return s + (priceAfterDiscount * (i.qty ?? 0));
    }, 0));
  }, [cart]);

  // Auto-fetch customer when mobile number is entered (debounced)
  useEffect(() => {
    if (!customerMobile || !customerMobile.trim()) {
      return;
    }

    const mobile = customerMobile.trim();
    // simple debounce to avoid spamming API while typing
    const timer = setTimeout(async () => {
      try {
        const res = await getCustomerByMobile(mobile);
        const cust = res.data;
        if (cust && cust.id) {
          setCustomer(cust);
          // if walletBalance present, allow using wallet
          if ((cust.walletBalance || 0) > 0) {
            setUseWallet(true);
            // reflect in cashReceived immediately if payment mode is CASH
            if (paymentMode === 'CASH') {
              const subtotalP = toPaise(subtotalBeforeDiscount);
              const walletP = toPaise(cust.walletBalance || 0);
              const walletIntP = Math.floor(walletP / 100) * 100;
              const walletToUseP = Math.min(walletIntP, subtotalP);
              const amountAfterWalletP = Math.max(0, subtotalP - walletToUseP);
              setCashReceived(Number(fromPaise(amountAfterWalletP).toFixed(2)));
            }
          }
        } else {
          setCustomer(null);
          setUseWallet(false);
        }
      } catch (err) {
        // ignore errors silently - customer may not exist
        setCustomer(null);
        setUseWallet(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customerMobile]);

  // Helper: compute discount, gst and grand total
  const computeTotals = () => {
    // Calculate total product discounts from cart items
    const productDiscountTotal = cart.reduce((sum, item) => {
      const discountPerUnit = item.discountAmount ?? 0;
      return sum + (discountPerUnit * item.qty);
    }, 0);
    
    // Add manual discount (if any)
    const manualDiscount = discountIsPercent ? (subtotalBeforeDiscount * discount) / 100 : discount;
    const discountAmt = productDiscountTotal + manualDiscount;
    
    const taxable = Math.max(0, subtotalBeforeDiscount - discountAmt);
    const gstAmt = taxable * gstRate;
    const grandTotal = taxable + gstAmt;
    return { discountAmt, taxable, gstAmt, grandTotal };
  };

  // Keep cashReceived in sync when payment mode or wallet usage changes
  useEffect(() => {
    if (paymentMode === 'CASH') {
      const subtotalP = toPaise(subtotalBeforeDiscount);
      if (useWallet && customer) {
        const walletP = toPaise(customer.walletBalance || 0);
        const walletIntP = Math.floor(walletP / 100) * 100; // use whole rupees only
        const walletToUseP = Math.min(walletIntP, subtotalP);
        const amountAfterWalletP = Math.max(0, subtotalP - walletToUseP);
        setCashReceived(Number(fromPaise(amountAfterWalletP).toFixed(2)));
      } else {
        // If not using wallet, default cashReceived to full amount
        setCashReceived(Number(fromPaise(subtotalP).toFixed(2)));
      }
    }
  }, [paymentMode, useWallet, customer, subtotalBeforeDiscount]);

  // Safe beep: try to play /beep.mp3, fallback to WebAudio tone if unavailable
  const playBeep = async () => {
    try {
      const audio = new Audio('/beep.mp3');
      await audio.play();
      return;
    } catch (err) {
      console.warn('beep.mp3 play failed, using WebAudio fallback', err);
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        if (ctx.state === 'suspended') await ctx.resume();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 1000;
        g.gain.value = 0.05;
        o.connect(g);
        g.connect(ctx.destination);
        o.start();
        await new Promise<void>(r => setTimeout(() => { try { o.stop(); } catch {} r(); }, 120));
        try { ctx.close(); } catch (_) {}
      } catch (e2) {
        console.warn('WebAudio fallback failed', e2);
      }
    }
  };

  // Keyboard shortcut: press 'd' to apply discount
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "d" || e.key === "D") {
        // don't trigger when typing in an input
        const active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
        const val = window.prompt(t('billing.enterDiscountPrompt'));
        if (!val) return;
        const trimmed = val.trim();
        if (trimmed.endsWith("%")) {
          const n = parseFloat(trimmed.slice(0, -1));
          if (!isNaN(n)) {
            setDiscount(n);
            setDiscountIsPercent(true);
          }
        } else {
          const n = parseFloat(trimmed);
          if (!isNaN(n)) {
            setDiscount(n);
            setDiscountIsPercent(false);
          }
        }
      }
      // REMOVED: 'P' key no longer opens payment modal
      // This was causing issues with barcodes containing 'P' character
      // Users should click the PAY button instead
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Handle lazy loading effect when filters change
  useEffect(() => {
    if (selectedCategory || selectedBrand) {
      setFilterLoadingDelay(true);
      const timer = setTimeout(() => {
        setFilterLoadingDelay(false);
      }, 300); // 300ms delay for loading effect
      return () => clearTimeout(timer);
    }
  }, [selectedCategory, selectedBrand]);

  // NOTE: Do not auto-fetch bill details on selection change anymore.
  // Bill details should be fetched explicitly when user requests them (e.g., clicks 'Return' or 'View Details').

  
  /* =====================
     Pay & Finalize
  ===================== */
  const pay = async () => {
    if (!billId || cart.length === 0) return;

    console.log("Processing payment for bill:", billId);

    setIsPaying(true);
    try {
      // If items are not reserved yet (maybe user skipped reserve step), add them now as a single batch
      if (!reservedForBill) {
        const payload = cart.map(item => ({
          productId: item.productId,
          batchNo: item.batchNo,
          quantity: item.qty,
          price: item.price,
          name: item.name,
          sku: item.sku,
          expiryDate: item.expiryDate
        }));

        const res = await addItemsBatch(billId, payload);
        console.log('addItemsBatch response', res?.data || res);
        setReservedForBill(true);
      }

      // compute payable
      const { discountAmt, gstAmt } = computeTotals();

      // Create/update customer and add discount to wallet
      let customerId: string | undefined;
      if (customerMobile) {
        const cust = await handleCustomerCreation(customerMobile, discountAmt, billId);
        customerId = cust?.id;
      } else if (customer && customer.id && discountAmt > 0) {
        // Customer already selected in UI (no mobile typed) - credit discount to their wallet
        try {
          const discountDescription = billId ? `Discount credited from Bill ${billId}` : 'Discount credited';
          await addToWallet(customer.id, discountAmt, discountDescription);
          // Update local customer state to reflect new wallet balance
          setCustomer({ ...customer, walletBalance: (customer.walletBalance || 0) + discountAmt });
          customerId = customer.id;
          console.log(`Discount ₹${discountAmt} credited to existing customer ${customer.id}`);
        } catch (err) {
          console.error('Failed to credit discount to existing customer wallet:', err);
        }
      }

      // Determine amount to charge with wallet deduction (use paise to avoid float issues)
      let amountToCharge = subtotalBeforeDiscount;
      let walletDeduction = 0;

      // If using wallet, deduct wallet balance
      if (useWallet && customer) {
        const subtotalP = toPaise(subtotalBeforeDiscount);
        const walletP = toPaise(customer.walletBalance || 0);
        const walletIntP = Math.floor(walletP / 100) * 100; // only whole rupees
        const walletDeductionP = Math.min(walletIntP, subtotalP);
        const amountToChargeP = Math.max(0, subtotalP - walletDeductionP);
        walletDeduction = fromPaise(walletDeductionP);
        amountToCharge = fromPaise(amountToChargeP);
      }

      // Compute explicit cash/wallet amounts for backend storage
      const cashPaid = paymentMode === 'WALLET' ? 0 : (paymentMode === 'CASH' ? (cashReceived ?? amountToCharge) : amountToCharge);
      const walletUsed = walletDeduction || 0;
      const amountPaidTotal = Number((Number(cashPaid) + Number(walletUsed)).toFixed(2));

      const paymentPayload = {
        payment: {
          mode: paymentMode || 'CASH',
          amountPaid: amountPaidTotal,
          cashPaid: Number(cashPaid),
          walletUsed: Number(walletUsed),
          customerMobile: customerMobile || null,
          customerId: customerId || null,
          discount: discountAmt,
          gst: gstAmt,
          grandTotal: subtotalBeforeDiscount
        }
      };

      // Finalize bill with payment details
      const finalizeRes = await finalizeBill(billId, paymentPayload);
      const serverData = finalizeRes?.data ?? null;

      // Deduct from customer wallet if wallet was used
      if (walletDeduction > 0 && customerId) {
        try {
          const desc = `Wallet payment for Bill ${billId} (₹${walletDeduction.toFixed(2)})`;
          await deductFromWallet(customerId, walletDeduction, desc);
          console.log(`Wallet deducted: ₹${walletDeduction} for customer ${customerId}, desc=${desc}`);
        } catch (error) {
          console.error('Error deducting from wallet:', error);
        }
      }

      setReceiptData({
        billId,
        items: cart.map(i => ({ ...i })),
        payment: paymentPayload.payment,
        totals: computeTotals(),
        server: serverData,
        walletUsed: walletUsed,
        amountToCharge: amountToCharge
      });
      setShowReceiptModal(true);
      // Close unified billing controls and clear barcode input so scanning UX resets
      setShowUnifiedControlsModal(false);
      if (barcodeRef.current) {
        barcodeRef.current.value = "";
      }
      // clear scanner buffers
      scannerBufferRef.current = "";
      scannerLastTimeRef.current = null;
    } catch (err: any) {
      console.error('Payment failed', err);
      const msg = err?.response?.data?.message || err?.message || String(err);
      alert(`❌ Payment failed: ${msg}`);
    } finally {
      setIsPaying(false);
    }
  };

  // Handle bill cancellation - release all reserved items
  const handleCancelBill = async () => {
    if (!billId) return;
    // Show confirmation modal instead of alert
    setShowCancelConfirmModal(true);
  };

  // Confirm and execute bill cancellation
  const confirmCancelBill = async () => {
    if (!billId) return;
    
    setIsCancelling(true);
    try {
      await cancelBill(billId);
      setShowCancelConfirmModal(false);
      
      // Show success notification
      setNotificationMessage('✅ Bill cancelled successfully! All reserved items have been released back to inventory.');
      setNotificationType("success");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
      
      // Reset UI
      setCart([]);
      setDiscount(0);
      setDiscountIsPercent(false);
      setCashReceived(undefined);
      setCustomerMobile('');
      setReservedForBill(false);
      setSubtotalBeforeDiscount(0);
      setTotal(0);
      setBillId(undefined);
    } catch (error: any) {
      console.error('Error cancelling bill:', error);
      const msg = error?.response?.data?.message || error?.message || String(error);
      setNotificationMessage(`❌ Failed to cancel bill: ${msg}`);
      setNotificationType("danger");
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
      setShowCancelConfirmModal(false);
    } finally {
      setIsCancelling(false);
    }
  };

  // Load all reserved items from inventory
  const loadReservedItemsList = async () => {
    setLoadingReserved(true);
    try {
      console.log("Loading reserved items from all products...");
      
      // Try to get reserved items from backend API
      const productIds = [1, 2, 3, 4, 5];
      const allReserved: ReservedItem[] = [];
      let successCount = 0;
      let failureCount = 0;
      
      for (const productId of productIds) {
        try {
          const res = await getReservedItems(productId);
          if (res.data && Array.isArray(res.data)) {
            // Ensure each item has a referenceId
            const itemsWithRef = res.data.map((item: any) => ({
              ...item,
              referenceId: item.referenceId || item.id || item.billId || `REF_${productId}_${Math.random()}`
            }));
            allReserved.push(...itemsWithRef);
            successCount++;
            console.log(`✅ Loaded ${res.data.length} items from product ${productId}`, itemsWithRef);
          }
        } catch (err: any) {
          failureCount++;
          // If 404, endpoint doesn't exist yet - that's OK, skip
          if (err?.response?.status === 404) {
            console.warn(`⚠️ API endpoint not available for product ${productId} (404)`);
          } else {
            console.warn(`Failed to load reserved items for product ${productId}:`, err);
          }
        }
      }
      
      // If no items found from any product
      if (allReserved.length === 0) {
        console.log("ℹ️ No reserved items found in database. Refund feature requires actual reservations.");
        console.log(`📌 API Status: ${successCount} successful, ${failureCount} failed`);
        console.log("� To test refund: First reserve items via billing process, then release them");
      }
      
      setReservedItems(allReserved);
      console.log("Reserved items loaded:", allReserved);
    } catch (e: any) {
      console.error('Failed to load reserved items', e);
      setReservedItems([]);
    } finally {
      setLoadingReserved(false);
    }
  };

  // Load inventory for modal display
  const loadInventoryForModal = async () => {
    setLoadingInventory(true);
    try {
      const res = await (await import("../../services/api")).default.get("/inventory");
      const inventoryData = res.data || [];
      
      // Fetch product details including barcode for each product
      const enrichedData = await Promise.all(
        inventoryData.map(async (product: any) => {
          try {
            const productRes = await (await import("../../services/api")).default.get(`/products/${product.productId}`);
            return {
              ...product,
              barcode: productRes.data?.barcode || undefined,
              category: productRes.data?.category || undefined,
              brandName: productRes.data?.brandName || undefined
            };
          } catch (error) {
            console.error(`Failed to fetch product ${product.productId}`, error);
            return product;
          }
        })
      );
      
      setInventoryData(enrichedData);
      
      // Extract unique categories and brands
      const uniqueCategories = [...new Set(enrichedData.map((p: any) => p.category).filter(Boolean))].sort();
      const uniqueBrands = [...new Set(enrichedData.map((p: any) => p.brandName).filter(Boolean))].sort();
      
      setCategories(uniqueCategories);
      setBrands(uniqueBrands);
      setSelectedCategory("");
      setSelectedBrand("");
      
      console.log("✅ Inventory loaded with barcodes, categories, and brands:", enrichedData);
      setInventoryLoaded(true);
    } catch (e: any) {
      console.error('Failed to load inventory', e);
      alert('Failed to load inventory: ' + (e?.response?.data?.message || e?.message || String(e)));
      setInventoryData([]);
    } finally {
      setLoadingInventory(false);
    }
  };

  // Fetch inventory using filters (category / brand) from server and enrich product details
  const fetchInventoryFiltered = async (filters: { category?: string; brand?: string } = {}) => {
    setFilterLoadingDelay(true);
    try {
      const apiClient = (await import("../../services/api")).default;
      const res = await apiClient.get("/inventory", { params: filters });
      const inventoryList = res.data || [];

      const enrichedData = await Promise.all(
        inventoryList.map(async (product: any) => {
          try {
            const productRes = await apiClient.get(`/products/${product.productId}`);
            return {
              ...product,
              barcode: productRes.data?.barcode || undefined,
              category: productRes.data?.category || undefined,
              brandName: productRes.data?.brandName || undefined
            };
          } catch (error) {
            console.error(`Failed to fetch product ${product.productId}`, error);
            return product;
          }
        })
      );

      setInventoryData(enrichedData);

      // Keep category/brand lists intact if already present, otherwise compute
      if (!categories || categories.length === 0) {
        const uniqueCategories = [...new Set(enrichedData.map((p: any) => p.category).filter(Boolean))].sort();
        setCategories(uniqueCategories);
      }
      if (!brands || brands.length === 0) {
        const uniqueBrands = [...new Set(enrichedData.map((p: any) => p.brandName).filter(Boolean))].sort();
        setBrands(uniqueBrands);
      }

      console.log("✅ Filtered inventory loaded:", filters, enrichedData);
    } catch (err: any) {
      console.error('Failed to load filtered inventory', err);
      setInventoryData([]);
    } finally {
      // small delay for UX so spinner is visible briefly
      setTimeout(() => setFilterLoadingDelay(false), 250);
    }
  };

  // Schedule a debounced inventory fetch to avoid rapid repeated API calls
  const scheduleFetchInventory = (filters: { category?: string; brand?: string } = {}, delay = 300) => {
    if (filterDebounceRef.current) {
      clearTimeout(filterDebounceRef.current);
    }
    filterDebounceRef.current = window.setTimeout(() => {
      fetchInventoryFiltered(filters);
      filterDebounceRef.current = null;
    }, delay) as unknown as number;
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (filterDebounceRef.current) clearTimeout(filterDebounceRef.current);
    };
  }, []);

  // Load rewards/wallet data for current customer
  const loadRewardsForCurrentCustomer = async () => {
    if (!customer || !customer.id) {
      alert('Please select a customer first');
      return;
    }

    setLoadingRewards(true);
    try {
      // Fetch wallet transactions
      try {
        const transRes = await getWalletTransactions(customer.id);
        setWalletTransactions(transRes.data || []);
      } catch (err) {
        console.warn("Could not fetch wallet transactions", err);
        setWalletTransactions([]);
      }

      // Fetch billing transactions
      try {
        const billRes = await getBillingTransactions(customer.id);
        const bills = billRes.data || [];
        const mappedBills = bills.map((bill: any) => ({
          billId: bill.billId || `BILL_${bill.id}`,
          amount: bill.totalAmount || 0,
          discount: bill.discount || 0,
          date: bill.billedAt ? new Date(bill.billedAt).toLocaleDateString() : new Date().toLocaleDateString(),
          itemCount: 1
        }));
        setBillTransactions(mappedBills);
      } catch (err) {
        console.warn("Could not fetch billing transactions", err);
        setBillTransactions([]);
      }

      console.log('✅ Rewards loaded:', { walletTransactions, billTransactions });
    } catch (e: any) {
      console.error('Failed to load rewards', e);
      alert('Failed to load rewards: ' + (e?.response?.data?.message || e?.message || String(e)));
    } finally {
      setLoadingRewards(false);
    }
  };

  // Search for customer by mobile number in rewards section
  const searchRewardsCustomer = async (mobileNo: string) => {
    if (!mobileNo.trim()) {
      setRewardsSearchError('Please enter a mobile number');
      setRewardsSearchedCustomer(null);
      return;
    }

    setLoadingRewards(true);
    setRewardsSearchError(null);
    try {
      const customerRes = await getCustomerByMobile(mobileNo);
      const cust = customerRes.data;
      setRewardsSearchedCustomer(cust);

      if (cust && cust.id) {
        // Fetch wallet transactions with pagination
        try {
          setWalletCurrentPage(0); // Reset to first page
          const transRes = await getWalletTransactionsPaginated(cust.id, 0, walletPageSize);
          const paginatedData = transRes.data as PaginatedResponse<WalletTransaction>;
          setWalletTransactions(paginatedData.content || []);
          setWalletTotalPages(paginatedData.totalPages);
          setWalletTotalElements(paginatedData.totalElements);
        } catch (err) {
          console.warn("Could not fetch wallet transactions", err);
          setWalletTransactions([]);
          setWalletTotalPages(0);
          setWalletTotalElements(0);
        }

        // Fetch billing transactions with pagination
        try {
          setBillCurrentPage(0); // Reset to first page
          const billRes = await getBillingTransactionsPaginated(cust.id, 0, billPageSize);
          const paginatedData = billRes.data as PaginatedResponse<any>;
          const mappedBills = paginatedData.content.map((bill: any) => ({
            id: bill.id,
            billId: bill.billId || `BILL_${bill.id}`,
            amount: bill.totalAmount || 0,
            discount: bill.discount || 0,
            date: bill.billedAt ? new Date(bill.billedAt).toLocaleDateString() : new Date().toLocaleDateString(),
            itemCount: 1
          }));
          setBillTransactions(mappedBills);
          setBillTotalPages(paginatedData.totalPages);
          setBillTotalElements(paginatedData.totalElements);
        } catch (err) {
          console.warn("Could not fetch billing transactions", err);
          setBillTransactions([]);
          setBillTotalPages(0);
          setBillTotalElements(0);
        }

        console.log('✅ Customer found:', { customer: cust, walletTransactions, billTransactions });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Customer not found";
      setRewardsSearchError(msg);
      setRewardsSearchedCustomer(null);
      setWalletTransactions([]);
      setBillTransactions([]);
    } finally {
      setLoadingRewards(false);
    }
  };

  // When filters change, fetch fresh batches from server for visible products (force API call every time)
  useEffect(() => {
    if (!inventoryLoaded) return;
    if (!selectedCategory || !selectedBrand) return;

    let cancelled = false;

    const refresh = async () => {
      try {
        setFilterLoadingDelay(true);
        const productsToRefresh = inventoryData.filter((p: any) => p.category === selectedCategory && p.brandName === selectedBrand);
        await Promise.all(productsToRefresh.map(async (p: any) => {
          try {
            const res = await getBatchesRaw(p.productId);
            const fetched = res?.data || [];
            if (cancelled) return;
            setInventoryData(prev => prev.map((item: any) => item.productId === p.productId ? { ...item, batches: fetched } : item));
          } catch (err) {
            console.warn('Failed to refresh batches for', p.productId, err);
          }
        }));
      } finally {
        setFilterLoadingDelay(false);
      }
    };

    refresh();

    return () => { cancelled = true; };
  }, [selectedCategory, selectedBrand, inventoryLoaded]);

  // Handle wallet transactions page change
  const handleWalletPageChange = async (newPage: number) => {
    if (!rewardsSearchedCustomer?.id) return;
    
    setWalletCurrentPage(newPage);
    setLoadingRewards(true);
    try {
      const transRes = await getWalletTransactionsPaginated(rewardsSearchedCustomer.id, newPage, walletPageSize);
      const paginatedData = transRes.data as PaginatedResponse<WalletTransaction>;
      setWalletTransactions(paginatedData.content || []);
      setWalletTotalPages(paginatedData.totalPages);
      setWalletTotalElements(paginatedData.totalElements);
    } catch (err) {
      console.warn("Could not fetch wallet transactions", err);
      setWalletTransactions([]);
    } finally {
      setLoadingRewards(false);
    }
  };

  // Handle billing history page change
  const handleBillPageChange = async (newPage: number) => {
    if (!rewardsSearchedCustomer?.id) return;
    
    setBillCurrentPage(newPage);
    setLoadingRewards(true);
    try {
      const billRes = await getBillingTransactionsPaginated(rewardsSearchedCustomer.id, newPage, billPageSize);
      const paginatedData = billRes.data as PaginatedResponse<any>;
      const mappedBills = paginatedData.content.map((bill: any) => ({
        id: bill.id,
        billId: bill.billId || `BILL_${bill.id}`,
        amount: bill.totalAmount || 0,
        discount: bill.discount || 0,
        date: bill.billedAt ? new Date(bill.billedAt).toLocaleDateString() : new Date().toLocaleDateString(),
        itemCount: 1
      }));
      setBillTransactions(mappedBills);
      setBillTotalPages(paginatedData.totalPages);
      setBillTotalElements(paginatedData.totalElements);
    } catch (err) {
      console.warn("Could not fetch billing transactions", err);
      setBillTransactions([]);
    } finally {
      setLoadingRewards(false);
    }
  };

  // Fetch bill details and items
  const handleViewBillDetails = async (billId: string, billDate: string, openReturnAfterLoad: boolean = false) => {
    setShowBillDetailsModal(true);
    setSelectedBillId(billId);
    setSelectedBillDate(billDate);
    setLoadingBillDetails(true);
    try {
      // Use billId (formatted like BILL_2026-06-15_0add41) for the API call
      const billRes = await getSummary(billId);
      const billData = billRes.data;
      // Extract items from bill summary
      const items = billData?.items || [];
      setBillItems(items);
      
      // Extract discount and totals from bill summary
      setBillDiscount(billData?.discount || 0);
      setBillSubTotal(billData?.subTotal || 0);
      setBillTaxAmount(billData?.taxAmount || 0);
      setBillTotalAmount(billData?.totalAmount || 0);
      
      // Check if bill has already been refunded
      try {
        const refundCheckRes = await checkBillRefundStatus(billId);
        setBillRefunded(refundCheckRes.data?.isRefunded || false);
      } catch (err) {
        // If endpoint fails, assume not refunded
        setBillRefunded(false);
      }
      
      console.log('✅ Bill details loaded:', { billId, items, discount: billData?.discount, total: billData?.totalAmount });
    } catch (err: any) {
      console.error('Failed to load bill details', err);
      alert('Failed to load bill details: ' + (err?.response?.data?.message || err?.message || String(err)));
      setBillItems([]);
      setBillDiscount(0);
      setBillSubTotal(0);
      setBillTaxAmount(0);
      setBillTotalAmount(0);
      setBillRefunded(false);
    } finally {
      setLoadingBillDetails(false);
      if (openReturnAfterLoad) {
        // Open the return items modal once bill details have loaded
        setShowReturnItemModal(true);
      }
    }
  };

  // Search for bills by mobile number or bill ID for refund
  const searchRefundBills = async (page: number = 0) => {


    if (!refundSearchMobile.trim() && !refundSearchBillId.trim()) {
      setRefundSearchError('Please enter either a mobile number or bill ID');
      setRefundSearchResults([]);
      return;
    }

    setLoadingRefundSearch(true);
    setRefundSearchError(null);
    try {
      let results: any[] = [];

      // Search by mobile number - fetch customer and then paginated bills
      if (refundSearchMobile.trim()) {
        try {
          // Fetch customer details by mobile
          const customerRes = await getCustomerByMobile(refundSearchMobile.trim());
          const customerData = customerRes.data;
          console.log('✅ Customer fetched:', customerData);

          // Fetch paginated bills for this customer
          const billRes = await getBillingTransactionsPaginated(customerData.id || '', page, refundPageSize);
          const bills = billRes.data?.content || [];
          const totalPages = billRes.data?.totalPages ?? 0;
          const totalElements = billRes.data?.totalElements ?? (bills.length);
          setRefundPage(page);
          setRefundTotalPages(totalPages);
          setRefundTotalElements(totalElements);
          
          results = bills.map((bill: any) => {
            // Format date properly - ensure we have a valid date
            let formattedDate = 'N/A';
            if (bill.billedAt) {
              try {
                const dateObj = new Date(bill.billedAt);
                formattedDate = dateObj.toLocaleDateString('en-IN', { 
                  year: 'numeric', 
                  month: '2-digit', 
                  day: '2-digit' 
                });
              } catch (e) {
                formattedDate = bill.billedAt;
              }
            }
            
            return {
              id: bill.id,
              billId: bill.billId || `BILL_${bill.id}`,
              amount: bill.totalAmount || 0,
              discount: bill.discount || 0,
              date: formattedDate,
              rawDate: bill.billedAt,
              customerId: customerData?.id || '',
              customerMobileNo: refundSearchMobile.trim(),
              customerWalletBalance: customerData?.walletBalance || 0,
              isCustomer: false
            };
          });
          
          console.log('✅ Paginated bills fetched for customer:', customerData.id, 'Page:', page, 'Results:', results);
        } catch (err) {
          console.warn("Could not fetch bills by mobile", err);
          setRefundSearchError('Error fetching bills for this mobile number');
        }
      }

      // If bill ID is provided, search specifically for that bill
      if (refundSearchBillId.trim()) {
        try {
          const billRes = await getSummary(refundSearchBillId.trim());
          const billData = billRes.data;
          
          let formattedDate = 'N/A';
          if (billData.billedAt || billData.createdAt) {
            try {
              const dateObj = new Date(billData.billedAt || billData.createdAt);
              formattedDate = dateObj.toLocaleDateString('en-IN', { 
                year: 'numeric', 
                month: '2-digit', 
                day: '2-digit' 
              });
            } catch (e) {
              formattedDate = billData.billedAt || billData.createdAt;
            }
          }
          
          results = [{
            id: billData.id || '',
            billId: billData.billId || refundSearchBillId.trim(),
            amount: billData.totalAmount || 0,
            discount: billData.discount || 0,
            date: formattedDate,
            rawDate: billData.billedAt || billData.createdAt,
            isCustomer: false
          }];
          // single-item result => set pagination metadata
          setRefundPage(0);
          setRefundTotalPages(1);
          setRefundTotalElements(1);
          console.log('✅ Bill fetched for ID:', refundSearchBillId, 'Result:', results);
        } catch (err) {
          console.warn("Could not fetch bill by ID", err);
          setRefundSearchError('Error fetching bill by ID');
        }
      }

      if (results.length === 0) {
        setRefundSearchError('No results found matching your search criteria');
        setRefundSearchResults([]);
        setRefundTotalElements(0);
        setRefundTotalPages(0);
        setRefundPage(0);
      } else {
        setRefundSearchResults(results);
        // Do not auto-select a bill; require the user to click 'Return' to load details
        setSelectedRefundBill(null);

        // For each result, check refund status and annotate results so UI can show a 'Refunded' flag
        const map: Record<string, boolean> = {};
        await Promise.all(results.map(async (r: any) => {
          try {
            const res = await checkBillRefundStatus(r.billId);
            map[r.billId] = res?.data?.isRefunded || false;
          } catch (err) {
            map[r.billId] = false;
          }
        }));
        setRefundedMap(map);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Search failed";
      setRefundSearchError(msg);
      setRefundSearchResults([]);
    } finally {
      setLoadingRefundSearch(false);
    }
  };

  const handleRefundPageChange = (newPage: number) => {
    // guard
    if (newPage < 0 || (refundTotalPages && newPage >= refundTotalPages)) return;
    searchRefundBills(newPage);
  };

  // Handle return of items - adjust inventory and add refund to wallet
  const handleReturnItems = async () => {
    // Validate selection
    const selectedCount = Object.values(returnItemSelection).reduce((sum, qty) => sum + qty, 0);
    if (selectedCount === 0) {
      setReturnError('Please select at least one item to return');
      return;
    }

    if (!selectedRefundBill || !selectedRefundBill.customerId) {
      setReturnError('Customer information not available');
      return;
    }

    // Prefill/reset payment method dialog state to avoid leftover values.
    // First, fetch the authoritative bill summary by billId to determine how it was paid.
    setReturnError(null);
    let billData: any = null;
    try {
      try {
        const summaryRes = await getSummary(selectedRefundBill.billId);
        billData = summaryRes?.data || null;
      } catch (err) {
        console.warn('Could not fetch bill summary for prefill, falling back to selectedRefundBill', err);
        billData = selectedRefundBill || null;
      }

      // store fetched summary so modal and other flows can use authoritative data
      setFetchedBillSummary(billData);

      // totalAmount not needed here; use billTotalAmount or billData where required
      const paymentObj = billData?.payment ?? {};
      const walletUsedVal = paymentObj?.walletUsed ?? paymentObj?.walletAmount ?? billData?.walletUsed ?? 0;
      const mode = (paymentObj?.mode || paymentObj?.paymentMode || billData?.paymentMode || '').toString().toLowerCase();

      // Prefill payment method strictly from API response; do not infer from other sources
      if (mode === 'wallet') {
        setPaymentMethodType('wallet');
        setWalletAmountUsed(Number(walletUsedVal));
        setWalletAmountInput(String(walletUsedVal || ''));
      } else if (mode === 'mixed') {
        setPaymentMethodType('mixed');
        setWalletAmountUsed(Number(walletUsedVal));
        setWalletAmountInput(String(walletUsedVal || ''));
      } else {
        setPaymentMethodType('cash');
        setWalletAmountUsed(0);
        setWalletAmountInput('');
      }
    } catch (err) {
      console.error('Failed to infer original payment method, defaulting to cash', err);
      setPaymentMethodType('cash');
      setWalletAmountUsed(0);
      setWalletAmountInput('');
    }

    // Auto-apply recommended refund allocation and proceed without showing modal
    try {
      const recommended = billData?.refund?.recommended;
      // If recommended is revertDiscountToWallet, set discount reversal to yes
      if (recommended === 'revertDiscountToWallet') {
        setDiscountReversalOption('yes');
      } else if (typeof recommended !== 'undefined') {
        setDiscountReversalOption('no');
      }

      // Populate original walletUsed from authoritative summary
      const originalWalletUsed = billData?.payment?.walletUsed ?? 0;
      setWalletAmountUsed(Number(originalWalletUsed));
      setWalletAmountInput(String(originalWalletUsed || ''));

      // Auto-select payment method from summary
      const mode = (billData?.payment?.mode || billData?.payment?.paymentMode || '').toString().toLowerCase();
      if (mode === 'wallet') setPaymentMethodType('wallet');
      else if (mode === 'mixed') setPaymentMethodType('mixed');
      else setPaymentMethodType('cash');

      // proceed automatically using the selected method
      await handleProcessRefundWithPaymentMethod();
    } catch (err) {
      console.error('Auto-processing refund failed, falling back to manual confirmation', err);
      setShowPaymentMethodModal(true);
    }
  };

  // Process refund after payment method selection
  const handleProcessRefundWithPaymentMethod = async () => {
    // Prevent duplicate refunds: check server status first
    if (selectedRefundBill?.billId) {
      try {
        const statusRes = await checkBillRefundStatus(selectedRefundBill.billId);
        const already = statusRes?.data?.isRefunded;
        if (already) {
          setReturnError('This bill has already been refunded');
          setBillRefunded(true);
          return;
        }
      } catch (err) {
        console.error('Failed to check refund status', err);
        // If status check fails, continue with local checks but do not block the flow
      }
    }

    // Validate payment method details
    if (paymentMethodType === 'mixed' && (walletAmountUsed <= 0 || walletAmountUsed > (billTotalAmount || 0))) {
      setReturnError('Please enter a valid wallet amount used for original payment');
      return;
    }

    setProcessingReturn(true);
    setReturnError(null);
    
    try {
      let totalItemRefundAmount = 0;
      let discountRefund = 0;
      
      // Process each item return and adjust inventory
      for (const [itemIndex, returnQty] of Object.entries(returnItemSelection)) {
        if (returnQty <= 0) continue;

        const itemIdx = parseInt(itemIndex);
        const item = billItems[itemIdx];
        
        if (!item) continue;

        const itemSubtotal = (item.quantity || 0) * (item.price || 0);
        const proportionalDiscount = billDiscount && billSubTotal 
          ? (billDiscount * itemSubtotal) / billSubTotal 
          : 0;
        const itemTotal = itemSubtotal - proportionalDiscount;
        const refundForThisItem = (itemTotal * returnQty) / (item.quantity || 1);
        
        totalItemRefundAmount += refundForThisItem;

        // Adjust inventory IN for returned items
        console.log(`📦 Returning ${returnQty} units of SKU: ${item.sku}`);
        await adjustInventory(item.productId, returnQty, 'IN', `Returned from Bill ${selectedRefundBill.billId}`);
      }

      // Re-fetch authoritative bill summary to decide how to split refunds
      let billData: any = null;
      try {
        const sres = await getSummary(selectedRefundBill.billId);
        billData = sres?.data || null;
      } catch (err) {
        console.warn('Could not re-fetch bill summary, using local values', err);
        billData = null;
      }

      const totalOriginalPayment = billData?.totalAmount || billTotalAmount || 0;
      const walletUsedOnBill = billData?.payment?.walletUsed ?? billData?.walletUsed ?? walletAmountUsed ?? 0;

      console.log(`📊 Payment Method: ${paymentMethodType}, Wallet Used on Bill: ${walletUsedOnBill}`);
      console.log(`🔍 DEBUG walletUsedOnBill sources - billData.payment.walletUsed=${billData?.payment?.walletUsed}, billData.walletUsed=${billData?.walletUsed}, walletAmountUsed=${walletAmountUsed}`);
      console.log(`🔍 DEBUG totalOriginalPayment=${totalOriginalPayment}, totalItemRefundAmount=${totalItemRefundAmount}`);

      // Determine wallet portion for item refunds
      let walletItemsRefund = 0;
      if (Number(walletUsedOnBill) && totalOriginalPayment > 0) {
        console.log(`✅ Wallet amount detected: ${walletUsedOnBill}`);
        // If wallet covered entire bill (or effectively equals total), refund items to wallet
        if (Math.abs(Number(walletUsedOnBill) - Number(totalOriginalPayment)) < 0.01) {
          console.log(`💳 Full wallet payment - refunding entire ${totalItemRefundAmount} to wallet`);
          walletItemsRefund = totalItemRefundAmount;
        } else {
          // Mixed payment: proportionally refund to wallet
          const walletRatio = Number(walletUsedOnBill) / Number(totalOriginalPayment);
          walletItemsRefund = totalItemRefundAmount * walletRatio;
          console.log(`💳 Mixed payment - walletRatio=${walletRatio.toFixed(4)}, walletItemsRefund=${walletItemsRefund.toFixed(2)}`);
        }
      } else {
        // No wallet used -> do not credit wallet for items
        console.log(`❌ No wallet used (walletUsedOnBill=${walletUsedOnBill}, totalOriginalPayment=${totalOriginalPayment})`);
        walletItemsRefund = 0;
      }

      // Determine if discount was actually credited to wallet for this bill (search wallet transactions)
      let shouldReverseDiscount = false;
      if (discountReversalOption === 'yes' && billDiscount > 0) {
        try {
          const transRes = await getWalletTransactions(selectedRefundBill.customerId);
          const txs = transRes.data || [];
          // Look for a credit transaction that references this bill id (common description used earlier)
          shouldReverseDiscount = txs.some((tx: any) => {
            const desc = (tx.description || '') + '';
            const amt = Number(tx.amount ?? tx.value ?? 0);
            // Heuristic: description contains billId and transaction is a credit
            return desc.includes(selectedRefundBill.billId) && amt > 0 && (tx.type === 'CREDIT' || (tx.credit && Number(tx.credit) > 0));
          });
        } catch (err) {
          console.warn('Could not fetch wallet transactions to verify discount credit:', err);
          shouldReverseDiscount = false;
        }
      }

      // Calculate proportional discount for returned items only if discount was credited earlier
      if (shouldReverseDiscount) {
        const totalOriginalQty = billItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const returnedQty = Object.entries(returnItemSelection)
          .reduce((sum, [_idx, qty]) => sum + (qty || 0), 0);
        discountRefund = totalOriginalQty > 0 ? (billDiscount * returnedQty) / totalOriginalQty : 0;
        console.log(`⬅️ Discount Reversal (verified): ₹${discountRefund.toFixed(2)} to debit from wallet`);
      } else {
        discountRefund = 0;
        if (billDiscount > 0 && discountReversalOption === 'yes') {
          console.log('ℹ️ Discount was not previously credited to wallet; skipping discount reversal');
        }
      }

      // Wallet actions: (1) attempt to debit discount reversal first (creates DEBIT entry),
      // (2) then credit the wallet-used payment portion (creates CREDIT entry).
      // This produces two distinct ledger lines like: Debit -₹7.00 (Revert discount...), Credit +₹5.00 (Payment for Bill...)
      let walletCreditDone = 0;
      let walletDebitDone = 0;

      if (discountRefund > 0) {
        try {
          const descDisc = `Revert discount from Bill ${selectedRefundBill.billId} (₹${discountRefund.toFixed(2)})`;
          await deductFromWallet(selectedRefundBill.customerId, discountRefund, descDisc);
          walletDebitDone = discountRefund;
          console.log(`⬇️ Deducted discount from wallet: ₹${discountRefund.toFixed(2)}`);
        } catch (err) {
          console.error('Failed to deduct discount from wallet (insufficient balance or error):', err);
          setReturnError('⚠️ Discount reversal failed: customer wallet has insufficient balance. Please process cash/card reversal manually.');
        }
      }

      if (walletItemsRefund > 0) {
        // Credit back the wallet amount that was used for payment on the original bill
        // Use a clear refund description so ledger lines reflect wallet refund (amount included)
        const descItems = `Wallet refund for Bill ${selectedRefundBill.billId} (₹${walletItemsRefund.toFixed(2)})`;
        console.log(`🔄 About to add to wallet - customerId=${selectedRefundBill.customerId}, amount=${walletItemsRefund}, desc=${descItems}`);
        try {
          const addRes = await addToWallet(selectedRefundBill.customerId, walletItemsRefund, descItems);
          walletCreditDone = walletItemsRefund;
          console.log(`✅ Credited wallet with items portion: ₹${walletItemsRefund.toFixed(2)}`, addRes);
        } catch (err) {
          console.error('❌ Failed to credit wallet for items refund:', err);
          // proceed — cashier can handle manual credit if necessary
          setReturnError('⚠️ Failed to credit wallet for items refund. Please check wallet service.');
        }
      } else {
        console.log(`⚠️ walletItemsRefund is 0, skipping wallet credit`);
      }

      const cashRefundAmount = Math.max(0, totalItemRefundAmount - (walletItemsRefund || 0));

      // Success notification with breakdown
      let successMsg = `✅ Return Processed!\n`;
      successMsg += `Total Items Refund: ₹${totalItemRefundAmount.toFixed(2)}\n`;
      if (walletDebitDone > 0) successMsg += `Discount Reversal (debited from wallet): ₹${walletDebitDone.toFixed(2)}\n`;
      else if (discountRefund > 0 && discountReversalOption === 'yes') successMsg += `Discount Reversal (attempted debit; fallback credited if needed): ₹${discountRefund.toFixed(2)}\n`;
      if (walletCreditDone > 0) successMsg += `Wallet Credit (items portion): ₹${walletCreditDone.toFixed(2)}\n`;
      if (cashRefundAmount > 0) successMsg += `Cash/Card Refund (return to customer): ₹${cashRefundAmount.toFixed(2)}\n`;
      const netWalletChange = (walletCreditDone - walletDebitDone);
      successMsg += `Net Wallet Change: ₹${netWalletChange.toFixed(2)}`;
      
      setNotificationMessage(successMsg);
      setNotificationType('success');
      setShowNotification(true);

      // Prepare refund slip data and show printable refund slip
      try {
        const refundSlip = {
          billId: selectedRefundBill.billId,
          date: new Date().toLocaleString(),
          customerId: selectedRefundBill.customerId,
          items: Object.entries(returnItemSelection).map(([idx, qty]) => {
            const item = billItems[parseInt(idx)];
            return {
              sku: item?.sku || item?.name,
              qty,
              unitPrice: item?.price || 0,
              gross: (item?.price || 0) * (qty || 0)
            };
          }),
          totals: {
            totalGross: Object.entries(returnItemSelection).reduce((s, [idx, qty]) => {
              const it = billItems[parseInt(idx)];
              return s + ((it?.price || 0) * (qty || 0));
            }, 0),
            walletCredit: walletCreditDone,
            discountReversed: walletDebitDone,
            cashRefund: cashRefundAmount,
            netWalletChange: (walletCreditDone - walletDebitDone)
          }
        };
        setRefundSlipData(refundSlip);
        setShowRefundSlip(true);
      } catch (e) {
        console.warn('Could not prepare refund slip', e);
      }

      // Mark bill as refunded to prevent duplicate refunds
      try {
        const netWalletChange = (walletCreditDone - walletDebitDone);
        await markBillAsRefunded(selectedRefundBill.billId, netWalletChange);
        console.log('✅ Bill marked as refunded');
        // Update local map so UI reflects refunded status immediately
        setRefundedMap(prev => ({ ...prev, [selectedRefundBill.billId]: true }));
      } catch (err) {
        console.error('⚠️ Failed to mark bill as refunded:', err);
        // Don't fail the entire operation if marking fails
      }

      // Reset form
      setReturnItemSelection({});
      setShowReturnItemModal(false);
      setShowPaymentMethodModal(false);
      
      // Reset bill details
      setBillItems([]);
      setBillDiscount(0);
      setBillSubTotal(0);
      setBillTaxAmount(0);
      setBillTotalAmount(0);
      setBillRefunded(true); // Update local state
      setShowBillDetailsModal(false);

      console.log('✅ Return completed successfully with payment method handling');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Failed to process return";
      console.error('❌ Return error:', err);
      setReturnError(msg);
    } finally {
      setProcessingReturn(false);
    }
  };

  // Release a reserved item - Enhanced with better error handling
  const handleReleaseItem = async () => {
    if (!selectedReservedItem) {
      alert('⚠️ Please select a reserved item to release');
      return;
    }

    if (releaseQty <= 0) {
      alert('⚠️ Please enter a valid quantity to release');
      return;
    }

    if (releaseQty > selectedReservedItem.quantity) {
      alert(`⚠️ Cannot release more than reserved quantity (${selectedReservedItem.quantity} units)`);
      return;
    }

    // Validate referenceId exists
    if (!selectedReservedItem.referenceId || !selectedReservedItem.referenceId.trim()) {
      console.error('Selected item:', selectedReservedItem);
      alert('❌ Error: Reference ID is missing. Cannot release item.');
      return;
    }

    setIsReleasing(true);
    try {
      const productId = selectedReservedItem.productId || 1;
      const referenceId = selectedReservedItem.referenceId.trim();
      
      console.log("🔄 Releasing item:", {
        productId,
        referenceId,
        quantity: releaseQty,
        selectedItem: selectedReservedItem
      });
      
      const response = await releaseInventory(
        productId,
        releaseQty,
        referenceId
      );
      
      console.log("✅ Release successful:", response);
      
      // Show success message with details
      const successMsg = `✅ Refund Successful!\n\n📦 Product: ${selectedReservedItem.productName || selectedReservedItem.sku}\n📊 Quantity Released: ${releaseQty} units\n📝 Reference: ${referenceId}\n\n✓ Stock is now available for new orders`;
      alert(successMsg);
      
      // Reset form
      setSelectedReservedItem(null);
      setReleaseQty(1);
      
      // Refresh the reserved items list
      await loadReservedItemsList();
      
      // Close modal after brief delay for better UX
      setTimeout(() => {
        setShowReleaseModal(false);
      }, 500);
      
    } catch (e: any) {
      console.error('❌ Release failed:', e);
      const errorMsg = e?.response?.data?.message || e?.message || String(e);
      console.error('Error details:', errorMsg);
      alert(`❌ Failed to release item:\n\n${errorMsg}`);
    } finally {
      setIsReleasing(false);
    }
  };

  /* =====================
     Cart quantity helpers
  ===================== */
  /* =====================
    Cart item quantity controls
  ===================== */
  const increaseQty = (productId: string, batchNo: string) => {
    // perform optimistic UI update only after server check; keep current state while checking
    const existing = cart.find(i => i.productId === productId && i.batchNo === batchNo);
    if (!existing) return;
    const newQty = existing.qty + 1;

    (async () => {
      try {
        const res = await (getBatchesDebounced ? getBatchesDebounced(productId, newQty) : getBatches(productId, newQty));
        const candidate = res.data[0];
        const avail = (candidate?.availableQty ?? 0) as number;
        if (avail < newQty) {
          const ok = window.confirm(`Only ${avail} unit(s) available in inventory. Increase quantity anyway?`);
          if (!ok) {
            alert('Not enough stock');
            return;
          }
        }
        setCart(prev => prev.map(i => i.productId === productId && i.batchNo === batchNo ? { ...i, qty: i.qty + 1 } : i));
      } catch (err) {
        console.error('Availability check failed', err);
        alert('Could not verify stock; try again');
      }
    })();
  };

  const decreaseQty = (productId: string, batchNo: string) => {
    setCart(prev => {
      return prev
        .map(i => {
          if (i.productId === productId && i.batchNo === batchNo) {
            return { ...i, qty: i.qty - 1 };
          }
          return i;
        })
        .filter(i => i.qty > 0);
    });
  };

  // Open batch allocation modal for Split action
  const openBatchAllocModal = async (_cartItem: CartItem) => {
    try {
      const productId = _cartItem.productId;
      const res = await (getBatchesDebounced ? getBatchesDebounced(productId, 1) : getBatches(productId, 1));
      const batches = res.data || [];
      if (!Array.isArray(batches) || batches.length === 0) {
        alert(t('billing.noBatchInfo'));
        return;
      }
      setBatchOptions(batches);
      setBatchModalProduct({ product: _cartItem, pid: productId });
      // initialize selection and qty map
      const initialSelected: string[] = [];
      const initialQtyMap: Record<string, number> = {};
      batches.forEach((b: any) => {
        const bNo = b.batchNo ?? String(b.id ?? "");
        initialQtyMap[bNo] = 1;
      });
      setBatchModalSelectedBatches(initialSelected);
      setBatchModalQtyMap(initialQtyMap);
      // default total qty for distribution: if splitting, use original item qty, else 1
      setBatchModalTotalQty((_cartItem as any)?.qty ?? 1);
      const idx = cart.findIndex(i => i.productId === _cartItem.productId && i.batchNo === _cartItem.batchNo);
      setBatchModalOriginalIndex(idx !== -1 ? idx : null);
      setShowBatchAllocModal(true);
    } catch (err) {
      console.error('Failed to load batches for allocation', err);
      alert(t('billing.noBatchInfo'));
    }
  };

  // Handle customer creation and wallet credit
  const handleCustomerCreation = async (mobileNo: string, discountAmount: number, billId?: string) => {
    try {
      if (!mobileNo.trim()) return null;
      
      // Get or create customer with billing ID
      const res = await getOrCreateCustomer(mobileNo, billId);
      const cust = res.data;
      setCustomer(cust);
      
      // Add discount to wallet if this is a new customer
      if (discountAmount > 0 && cust) {
        const discountDescription = billId ? `Discount credited from Bill ${billId}` : 'Discount credited';
        await addToWallet(cust.id || '', discountAmount, discountDescription);
        setCustomer({...cust, walletBalance: (cust.walletBalance || 0) + discountAmount});
      }
      
      return cust;
    } catch (err) {
      console.error('Customer creation failed', err);
      alert('⚠️ Could not create customer account, but billing will continue');
      return null;
    }
  };

  

  // Batch allocation modal handler removed — allocation performed automatically
  // Apply selected batch from modal (Split action)
  const applyBatchSelection = async () => {
    if (!batchModalProduct) return;

    const selectedBatches = batchModalSelectedBatches.slice();
    if (selectedBatches.length === 0) return;

    

    const fromSplit = batchModalOriginalIndex !== null && !!cart[batchModalOriginalIndex];

    if (fromSplit) {
      // Single state update: move totalRequested (capped by original qty) from original into selected batches in order
      const totalRequested = selectedBatches.reduce((s, bNo) => s + Math.max(1, Math.floor(batchModalQtyMap[bNo] || 1)), 0);
      setCart(prev => {
        const copy = [...prev];
        const origIdx = batchModalOriginalIndex ?? -1;
        if (origIdx < 0 || origIdx >= copy.length) return prev;
        const orig = copy[origIdx];
        if (!orig) return prev;
        const availableOrig = orig.qty;
        let toMove = Math.min(availableOrig, totalRequested);
        // reduce original's qty by toMove
        orig.qty = orig.qty - toMove;
        // create new items for each selected batch in order
        for (const bNo of selectedBatches) {
          if (toMove <= 0) break;
          const batchInfo = batchOptions.find(b => (b.batchNo ?? String(b.id ?? '')) === bNo) || batchOptions[0];
          const req = Math.max(1, Math.floor(batchModalQtyMap[bNo] || 1));
          const take = Math.min(req, toMove, batchInfo?.availableQty ?? req);
          if (take <= 0) continue;
          // add or merge into cart
          const existsIdx = copy.findIndex(i => i.productId === String(batchModalProduct.pid) && i.batchNo === bNo);
          if (existsIdx !== -1) {
            copy[existsIdx].qty += take;
          } else {
            const prod = batchModalProduct.product || batchModalProduct;
            copy.push({
              productId: String(batchModalProduct.pid),
              batchNo: bNo,
              name: prod.name ?? prod.title ?? batchModalProduct.productName ?? '',
              sku: prod.sku ?? prod.skuCode ?? batchModalProduct.sku ?? '',
              price: prod.price ?? batchModalProduct.price ?? 0,
              discountAmount: prod.discountAmount ?? batchModalProduct.discountAmount ?? 0,
              qty: take,
              availableQty: batchInfo.availableQty ?? 0,
              expiryDate: (typeof batchInfo.expiryDate === 'string') ? batchInfo.expiryDate : (batchInfo.expiryDate ? new Date(batchInfo.expiryDate).toISOString() : '')
            });
          }
          toMove -= take;
        }
        // remove original if qty zero
        const final = copy.filter(i => !(i.productId === String(orig.productId) && i.batchNo === orig.batchNo && i.qty <= 0));
        return final;
      });
    } else {
      // Not splitting: just add requested quantities as new/merged items
      setCart(prev => {
        const copy = [...prev];
        for (const bNo of selectedBatches) {
          const batchInfo = batchOptions.find(b => (b.batchNo ?? String(b.id ?? '')) === bNo) || batchOptions[0];
          const qtyReq = Math.max(1, Math.floor(batchModalQtyMap[bNo] || 1));
          const pidStr = String(batchModalProduct?.pid ?? batchModalProduct?.productId ?? '');
          const existsIdx = copy.findIndex(i => i.productId === pidStr && i.batchNo === bNo);
          if (existsIdx !== -1) {
            copy[existsIdx].qty += qtyReq;
          } else {
            const prod = batchModalProduct.product || batchModalProduct;
            copy.push({
              productId: pidStr,
              batchNo: bNo,
              name: prod.name ?? prod.title ?? batchModalProduct.productName ?? '',
              sku: prod.sku ?? prod.skuCode ?? batchModalProduct.sku ?? '',
              price: prod.price ?? batchModalProduct.price ?? 0,
              discountAmount: prod.discountAmount ?? batchModalProduct.discountAmount ?? 0,
              qty: qtyReq,
              availableQty: batchInfo.availableQty ?? 0,
              expiryDate: (typeof batchInfo.expiryDate === 'string') ? batchInfo.expiryDate : (batchInfo.expiryDate ? new Date(batchInfo.expiryDate).toISOString() : '')
            });
          }
        }
        return copy;
      });
    }

    // Close modal and reset
    setShowBatchAllocModal(false);
    setBatchOptions([]);
    setBatchModalProduct(null);
    setBatchModalOriginalIndex(null);
    setBatchModalQtyMap({});
    setBatchModalSelectedBatches([]);
  };

    const distributeSelectedBatches = (total: number) => {
      // Distribute `total` across selected batches preferring earliest expiry and availableQty
      let remaining = Math.max(0, Math.floor(total || 0));
      const selected = batchModalSelectedBatches.slice();
      const batchInfos = selected.map(bNo => ({ bNo, info: batchOptions.find(b => (b.batchNo ?? String(b.id ?? '')) === bNo) }));
      batchInfos.sort((a, b) => {
        const ta = new Date(a.info?.expiryDate ?? a.info?.expiry ?? 0).getTime() || 0;
        const tb = new Date(b.info?.expiryDate ?? b.info?.expiry ?? 0).getTime() || 0;
        return ta - tb;
      });
      const newMap: Record<string, number> = { ...batchModalQtyMap };
      for (const { bNo, info } of batchInfos) {
        if (remaining <= 0) { newMap[bNo] = 0; continue; }
        const avail = info?.availableQty ?? 0;
        const take = Math.min(avail, remaining);
        newMap[bNo] = take;
        remaining -= take;
      }
      if (remaining > 0) {
        alert(`Only ${Math.max(0, Math.floor(total) - remaining)} of ${total} could be allocated; not enough stock in selected batches.`);
      }
      setBatchModalQtyMap(newMap);
    };

    return (
    <div className="billing-page-container">
      <ShopkeeperHeader 
        title={t('billing.pageTitle')}
        description={t('billing.pageDescription')}
      />
      
      <Container className="billing-content" style={{ maxWidth: 1100 }}>
        {/* Notification Alert - Fixed position at top */}
        {showNotification && (
          <Alert 
            variant={notificationType} 
            onClose={() => setShowNotification(false)} 
            dismissible
            className="mb-3 position-fixed top-0 start-50 translate-middle-x"
            style={{ zIndex: 9999, width: '90%', maxWidth: '500px', marginTop: '20px' }}
          >
            {notificationMessage}
          </Alert>
        )}
        
        {/* Main Billing Section */}
        <div className="billing-main-card">
          <div className="billing-header-section">
            <div className="billing-title-area">
              <div className="mb-2">
                <div className="d-flex justify-content-start mb-2">
                  <Button 
                    variant="primary"
                    onClick={async () => {
                      await handleGoBackToBilling();
                      setTimeout(() => handleStartBilling(), 300);
                    }}
                    className="fw-bold px-3"
                    style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    {t('billing.startBill')}
                  </Button>
                </div>
                <div className="d-flex align-items-center justify-content-between gap-2">
                  <h5 className="mb-0" style={{ fontSize: '1rem', fontWeight: 'bold' }}>{t('billing.billDetails')}</h5>
                  {billId && <Badge className="billing-badge bg-primary" style={{ flexShrink: 0, fontSize: '0.85rem' }}>{t('billing.billLabel', { billId })}</Badge>}
                </div>
              </div>
            </div>
          </div>

          <div className="billing-body">
          <Row className="g-2">
            <Col xs={12} md={8}>
              <InputGroup>
                <Form.Control
                  ref={barcodeRef}
                  placeholder={t('billing.scanPlaceholder')}
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      console.log("manual Enter pressed, value:", e.currentTarget.value);
                      handleBarcode(e.currentTarget.value);
                    }
                  }}
                  style={{ fontSize: 18 }}
                />
                <Button variant="outline-secondary" onClick={() => barcodeRef.current?.focus()}>{t('billing.focus')}</Button>
              </InputGroup>
            </Col>

              <Col xs={12} md={4} className="d-flex gap-2">
                <Button
                  variant="primary"
                  onClick={() => {
                    setUnifiedModalTab("inventory");
                    setShowUnifiedControlsModal(true);
                  }}
                  className="flex-grow-1"
                >
                  {t('billing.billingControls')}
                </Button>
              </Col>
          </Row>

          <Table striped bordered hover size="sm" className="mt-3">
            <thead>
              <tr>
                <th>{t('billing.table.item')}</th>
                <th style={{ width: 180 }}>{t('billing.table.qty')}</th>
                <th style={{ width: 120 }}>{t('billing.table.price')}</th>
                <th style={{ width: 100 }}>{t('billing.table.discount')}</th>
                <th style={{ width: 140 }}>{t('billing.table.total')}</th>
                <th style={{ width: 100 }}>{t('billing.table.action')}</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(i => {
                const discountPerUnit = i.discountAmount ?? 0;
                const totalDiscount = discountPerUnit * i.qty;
                const priceAfterDiscount = Math.max(0, (i.price ?? 0) - discountPerUnit);
                const cartItemTotal = priceAfterDiscount * i.qty;
                return (
                  <tr key={`${i.productId}-${i.batchNo}`}>
                    <td style={{ maxWidth: 300 }}>{i.sku || i.name}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <Button size="sm" variant="outline-secondary" onClick={() => decreaseQty(i.productId, i.batchNo)}>-</Button>
                        <div className="px-3">{i.qty}</div>
                        <Button size="sm" variant="outline-secondary" onClick={() => increaseQty(i.productId, i.batchNo)}>+</Button>
                        <div className="ms-auto small text-muted">{t('billing.available')}: {i.availableQty}</div>
                      </div>
                    </td>
                    <td>₹{i.price.toFixed(2)}</td>
                    <td>₹{totalDiscount.toFixed(2)}</td>
                    <td>₹{cartItemTotal.toFixed(2)}</td>
                    <td>
                      <Button size="sm" variant="info" onClick={() => openBatchAllocModal(i)}>
                        Split
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          {/* Summary */}
          <Row className="mt-2">
            <Col md={{ span: 4, offset: 8 }}>
              {(() => {
                const { discountAmt, gstAmt, grandTotal } = computeTotals();
                return (
                  <>
                    <div className="d-flex justify-content-between small">
                      <div>{t('billing.subtotal')}</div>
                      <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                    </div>
                    <div className="d-flex justify-content-between small">
                      <div>{t('billing.discountLabel')} {discountIsPercent ? `(${discount}%)` : ''}</div>
                      <div>₹{discountAmt.toFixed(2)}</div>
                    </div>
                    <div className="d-flex justify-content-between small">
                      <div>{t('billing.gst')}</div>
                      <div>₹{gstAmt.toFixed(2)}</div>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between fw-bold">
                      <div>{t('billing.grandTotal')}</div>
                      <div>₹{grandTotal.toFixed(2)}</div>
                    </div>
                  </>
                );
              })()}
            </Col>
          </Row>

          <div className="billing-total-section">
            <h4 className="billing-total-label">
              {t('billing.totalLabel')}: <Badge className="billing-total-badge bg-success">₹{total.toFixed(2)}</Badge>
            </h4>
          </div>
            </div>
          </div>
      </Container>

      {/* Unified Controls Modal - All controls in one place */}
      <Modal 
        show={showUnifiedControlsModal} 
        onHide={() => setShowUnifiedControlsModal(false)} 
        scrollable
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{t('billing.billingControlsTitle', { billId: billId || '' })}</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ minHeight: '500px', display: 'flex', flexDirection: 'column' }}>
          {/* Tab Navigation */}
          <div className="d-flex gap-2 mb-3 border-bottom" style={{ flexShrink: 0 }}>
            <Button
              variant={unifiedModalTab === "payment" ? "primary" : "outline-secondary"}
              size="sm"
              onClick={() => setUnifiedModalTab("payment")}
              className="px-3"
            >
              {t('billing.tab.payment')}
            </Button>
            <Button
              variant={unifiedModalTab === "inventory" ? "primary" : "outline-secondary"}
              size="sm"
              onClick={() => {
                setUnifiedModalTab("inventory");
                if (!inventoryLoaded) {
                  loadInventoryForModal();
                }
              }}
              className="px-3"
            >
              {t('billing.tab.inventory')}
            </Button>
            <Button
              variant={unifiedModalTab === "refund" ? "primary" : "outline-secondary"}
              size="sm"
              onClick={() => {
                setUnifiedModalTab("refund");
                loadReservedItemsList();
              }}
              className="px-3"
            >
              {t('billing.tab.refund')}
            </Button>
            <Button
              variant={unifiedModalTab === "rewards" ? "primary" : "outline-secondary"}
              size="sm"
              onClick={() => {
                setUnifiedModalTab("rewards");
                if (customer && customer.id) {
                  loadRewardsForCurrentCustomer();
                }
              }}
              className="px-3"
            >
              💳 Rewards
            </Button>
          </div>

          {/* TAB 1: PAYMENT */}
          {unifiedModalTab === "payment" && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h6 className="fw-bold mb-3">{t('billing.paymentProcessing')}</h6>
              
              {/* Customer Mobile Input */}
              <Form.Group className="mb-3">
                <Form.Label className="fw-bold">{t('billing.customerMobileOptional')}</Form.Label>
                <Form.Control 
                  placeholder={t('billing.customerMobilePlaceholder')}
                  maxLength={10}
                  value={customerMobile} 
                  onChange={async (e) => {
                    const mobile = e.target.value;
                    setCustomerMobile(mobile);

                    if (mobile.length === 10) {
                      try {
                        const response = await getCustomerByMobile(mobile);
                        if (response?.data) {
                          const cust = response.data;
                          setCustomer(cust);
                          // immediately enable wallet usage if balance exists
                          const hasBalance = (cust.walletBalance || 0) > 0;
                          setUseWallet(hasBalance);
                          if (hasBalance && paymentMode === 'CASH') {
                            const subtotalP = toPaise(subtotalBeforeDiscount);
                            const walletP = toPaise(cust.walletBalance || 0);
                            const walletIntP = Math.floor(walletP / 100) * 100;
                            const walletToUseP = Math.min(walletIntP, subtotalP);
                            const amountAfterWalletP = Math.max(0, subtotalP - walletToUseP);
                            setCashReceived(Number(fromPaise(amountAfterWalletP).toFixed(2)));
                          }
                        } else {
                          setCustomer(null);
                          setUseWallet(false);
                        }
                      } catch (err) {
                        setCustomer(null);
                        setUseWallet(false);
                      }
                    } else if (mobile.length === 0) {
                      setCustomer(null);
                      setUseWallet(false);
                    }
                  }}
                />
                {customerMobile.length === 10 && !customer && (
                  <small className="d-block mt-2 text-info">
                    {t('billing.newCustomerWallet')}
                  </small>
                )}
              </Form.Group>

              <hr className="my-3" />

              {/* Bill Summary */}
                {(() => {
                const { discountAmt, gstAmt } = computeTotals();
                const walletBalance = customer?.walletBalance || 0;
                // Use only the integer-rupee portion of the wallet (floor)
                const subtotalP_local = toPaise(subtotalBeforeDiscount);
                const walletP_local = toPaise(walletBalance);
                const walletIntP_local = Math.floor(walletP_local / 100) * 100; // whole rupees in paise
                const walletToUse = fromPaise(Math.min(walletIntP_local, subtotalP_local));
                const amountAfterWallet = fromPaise(Math.max(0, subtotalP_local - Math.min(walletIntP_local, subtotalP_local)));
                
                return (
                  <>
                    <div className="fw-bold mb-3 text-primary">{t('billing.billSummary')}</div>
                    
                    <div className="d-flex justify-content-between small mb-1">
                      <div>Subtotal</div>
                      <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                    </div>

                    <div className="d-flex justify-content-between small mb-1">
                      <div>Discount {discountIsPercent ? `(${discount}%)` : ''}</div>
                      <div>₹{discountAmt.toFixed(2)}</div>
                    </div>

                    <div className="d-flex justify-content-between small mb-3">
                      <div>GST</div>
                      <div>₹{gstAmt.toFixed(2)}</div>
                    </div>

                    <div className="d-flex justify-content-between fw-bold p-2 bg-light rounded mb-3">
                      <div>Grand Total</div>
                      <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                    </div>

                    {/* Wallet Option (show when customer exists; disable if zero balance) */}
                    {customer && (
                      <div className="bg-success bg-opacity-10 p-3 rounded mb-3 border border-success">
                        <div className="small fw-bold text-success mb-2">{t('billing.walletAvailable', { amount: walletBalance.toFixed(2) })}</div>
                        <Form.Check 
                          type="checkbox"
                          id="useWalletUnified"
                          label={t('billing.useWalletLabel', { walletAmount: walletToUse.toFixed(2), payAmount: amountAfterWallet.toFixed(2) })}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setUseWallet(checked);
                            // If paying by cash, reflect remaining amount in cashReceived when wallet is toggled
                            if (paymentMode === 'CASH') {
                              const walletBalanceLocal = customer?.walletBalance || 0;
                              const subtotalP = toPaise(subtotalBeforeDiscount);
                              const walletP = toPaise(walletBalanceLocal);
                              const walletIntP = Math.floor(walletP / 100) * 100;
                              const walletToUseP = Math.min(walletIntP, subtotalP);
                              const amountAfterWalletP = Math.max(0, subtotalP - (checked ? walletToUseP : 0));
                              setCashReceived(Number(fromPaise(amountAfterWalletP).toFixed(2)));
                            }
                          }}
                          className="fw-bold small"
                          disabled={walletBalance <= 0}
                        />
                        {walletBalance <= 0 && (
                          <div className="small text-muted mt-2">{t('billing.noWalletBalance')}</div>
                        )}
                      </div>
                    )}

                    <hr className="my-3" />
                  </>
                );
              })()}

              {/* Payment Mode */}
              <Form.Group className="mb-2">
                <Form.Label>{t('billing.paymentMode')}</Form.Label>
                <Form.Select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
                  <option value="CASH">{t('billing.paymentMethod.cash')}</option>
                  <option value="UPI">{t('billing.paymentMethod.upi')}</option>
                  <option value="CARD">{t('billing.paymentMethod.card')}</option>
                  <option value="CREDIT">{t('billing.paymentMethod.credit')}</option>
                </Form.Select>
              </Form.Group>

              {paymentMode === 'CASH' && (
                <Form.Group className="mb-3">
                  <Form.Label>{t('billing.cashReceived')}</Form.Label>
                  <Form.Control type="number" value={cashReceived ?? ''} onChange={e => setCashReceived(Number(e.target.value))} />
                  <div className="small text-muted mt-1">{t('billing.changeLabel', { amount: (() => {
                    const change = Math.max(0, (cashReceived ?? 0) - subtotalBeforeDiscount);
                    return change.toFixed(2);
                  })() })}</div>
                </Form.Group>
              )}
            </div>
          )}

          {/* TAB 2: INVENTORY CHECK */}
          {unifiedModalTab === "inventory" && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h6 className="fw-bold mb-3">{t('billing.inventoryCheck')}</h6>
              
              {!inventoryLoaded ? (
                <div className="text-center py-5">
                  <p style={{ marginBottom: '1.5rem', fontSize: '1rem', color: '#666' }}>
                    {t('billing.clickLoadInventory')}
                  </p>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={loadInventoryForModal}
                    disabled={loadingInventory}
                  >
                    {loadingInventory ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        {t('billing.loadingInventory')}
                      </>
                    ) : (
                      t('billing.loadInventoryData')
                    )}
                  </Button>
                </div>
              ) : (
                <>
                  {/* Filter Dropdowns */}
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                    {/* Category Dropdown */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <Form.Select
                        value={selectedCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setSelectedCategory(cat);
                          setSelectedBrand("");
                          // Debounced fetch for selected category
                          scheduleFetchInventory({ category: cat });
                        }}
                        size="sm"
                      >
                        <option value="">{t('billing.allCategories')}</option>
                        {categories.map((cat: string) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Form.Select>
                    </div>

                    {/* Brand Dropdown */}
                    <div style={{ flex: 1, minWidth: '140px' }}>
                      <Form.Select
                        value={selectedBrand}
                        onChange={(e) => {
                          const br = e.target.value;
                          setSelectedBrand(br);
                          // Debounced fetch for selected brand and current category
                          scheduleFetchInventory({ category: selectedCategory || undefined, brand: br || undefined });
                        }}
                        size="sm"
                      >
                        <option value="">{t('billing.allBrands')}</option>
                        {brands
                          .filter((brand: string) =>
                            !selectedCategory ||
                            inventoryData.some((p: any) => p.brandName === brand && p.category === selectedCategory)
                          )
                          .map((brand: string) => (
                            <option key={brand} value={brand}>{brand}</option>
                          ))}
                      </Form.Select>
                    </div>

                    {(selectedCategory || selectedBrand) && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedCategory("");
                          setSelectedBrand("");
                        }}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {t('billing.clearFilters')}
                      </Button>
                    )}
                  </div>

                  {!selectedCategory || !selectedBrand ? (
                    <div className="text-center text-muted py-5">
                      <p style={{ fontSize: '0.95rem' }}>
                        {!selectedCategory ? t('billing.selectCategory') : t('billing.selectBrand')}
                      </p>
                    </div>
                  ) : filterLoadingDelay ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-3">{t('billing.loadingFilteredResults')}</p>
                    </div>
                  ) : (() => {
                    const filteredInventory = inventoryData.filter((product: any) =>
                      product.category === selectedCategory &&
                      product.brandName === selectedBrand
                    );
                    
                    return filteredInventory.length === 0 ? (
                      <div className="text-center text-muted py-5">
                        <p>{inventoryData.length === 0 ? t('billing.noInventoryItems') : t('billing.noMatchingFilters')}</p>
                      </div>
                    ) : (
                      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {filteredInventory.map((product: any) => (
                          <div key={product.productId} style={{ 
                            borderBottom: '1px solid #e0e0e0', 
                            padding: '0.75rem',
                            marginBottom: '0.5rem',
                            borderRadius: '6px',
                            backgroundColor: '#f9f9f9'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                              <div style={{ flex: 1 }}>
                                <h6 style={{ margin: '0 0 0.15rem 0', fontWeight: 'bold', fontSize: '0.95rem' }}>{product.productName}</h6>
                                <small style={{ color: '#666', fontSize: '0.8rem' }}>SKU: {product.productSku}</small>
                              </div>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                <Badge bg="primary" style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                                  {product.totalQty}
                                </Badge>
                                {/* Refresh Batches button removed — batches auto-refresh when filters change */}
                              </div>
                            </div>

                            {product.batches && product.batches.length > 0 ? (
                              <div style={{ marginTop: '0.5rem' }}>
                                <small style={{ fontWeight: '600', color: '#333', display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem' }}>Batches:</small>
                                {product.batches.map((batch: any, idx: number) => {
                                  const today = new Date();
                                  const expiry = new Date(batch.expiry);
                                  const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                                  let expiryStatus = 'Valid';
                                  let badgeColor = 'success';
                                  
                                  if (daysLeft < 0) {
                                    expiryStatus = 'Expired';
                                    badgeColor = 'danger';
                                  } else if (daysLeft <= 30) {
                                    expiryStatus = `Near Expiry (${daysLeft}d)`;
                                    badgeColor = 'warning';
                                  }
                                  
                                  const isLowStock = batch.qty <= 20;
                                  
                                  return (
                                    <div key={idx} style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '0.35rem 0.4rem',
                                      backgroundColor: '#fff',
                                      marginBottom: '0.3rem',
                                      borderRadius: '4px',
                                      border: '1px solid #ddd'
                                    }}>
                                      <div style={{ flex: 1 }}>
                                        <small style={{ fontWeight: '500', fontSize: '0.75rem' }}>Batch: {batch.batchNo}</small>
                                        <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.1rem' }}>
                                          {t('billing.batchExpiry')}: {new Date(batch.expiry).toLocaleDateString()}
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                                        <Badge bg={isLowStock ? 'danger' : 'success'} style={{ padding: '0.25rem 0.4rem', fontSize: '0.65rem' }}>
                                          {batch.qty}
                                        </Badge>
                                        <Badge bg={badgeColor} style={{ padding: '0.25rem 0.4rem', fontSize: '0.65rem' }}>
                                          {expiryStatus}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <small style={{ color: '#999', fontStyle: 'italic' }}>{t('billing.noBatches')}</small>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {/* Auto-refresh batches when filters change: always call server (raw) for latest batches */}
          {/* Fetch fresh batches for visible products whenever selectedCategory or selectedBrand changes */}
          

          {/* TAB 3: REFUND */}
          {unifiedModalTab === "refund" && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h6 className="fw-bold mb-3">{t('billing.refundTitle')}</h6>
              
              {/* Refund Search Section */}
              <div className="card mb-4" style={{ backgroundColor: '#f8f9fa', border: '1px solid #dee2e6' }}>
                <div className="card-body">
                  <h6 className="fw-bold mb-3">🔍 Find Bill for Refund</h6>
                  
                  <div className="mb-3">
                    <small className="text-muted d-block mb-2">Search by Mobile Number OR Bill ID</small>
                    <InputGroup>
                      <Form.Control
                        placeholder="Enter mobile number (e.g., 9876543210)"
                        value={refundSearchMobile}
                        onChange={(e) => {
                          setRefundSearchMobile(e.target.value);
                          setRefundSearchBillId(""); // Clear bill ID when entering mobile
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchRefundBills();
                          }
                        }}
                        disabled={loadingRefundSearch}
                      />
                    </InputGroup>
                  </div>

                  <div className="mb-3">
                    <small className="text-muted d-block mb-2">OR</small>
                    <InputGroup>
                      <Form.Control
                        placeholder="Enter Bill ID (e.g., BILL_2026-06-15_0add41)"
                        value={refundSearchBillId}
                        onChange={(e) => {
                          setRefundSearchBillId(e.target.value);
                          setRefundSearchMobile(""); // Clear mobile when entering bill ID
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            searchRefundBills();
                          }
                        }}
                        disabled={loadingRefundSearch}
                      />
                    </InputGroup>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => searchRefundBills()}
                    disabled={loadingRefundSearch}
                    className="w-100"
                  >
                    {loadingRefundSearch ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Searching...
                      </>
                    ) : (
                      '🔍 Search Bills'
                    )}
                  </Button>

                  {refundSearchError && (
                    <Alert variant="warning" className="mt-3 mb-0">
                      <small>{refundSearchError}</small>
                    </Alert>
                  )}
                </div>
              </div>

              {/* Search Results */}
              {refundSearchResults.length > 0 && (
                <div className="mb-4">
                  <h6 className="fw-bold mb-3">📋 Found Bills ({refundTotalElements})</h6>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table table-hover table-sm mb-0" style={{ cursor: 'pointer' }}>
                      <thead style={{ backgroundColor: '#e9ecef' }}>
                        <tr>
                          <th style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Bill ID</th>
                          <th style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Date</th>
                          <th style={{ fontSize: '0.85rem', fontWeight: 'bold' }} className="text-end">Amount</th>
                          <th style={{ fontSize: '0.85rem', fontWeight: 'bold' }} className="text-end">Discount</th>
                          <th style={{ fontSize: '0.85rem', fontWeight: 'bold' }} className="text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {refundSearchResults.map((bill, index) => (
                          <tr
                            key={index}
                            style={{
                              backgroundColor: selectedRefundBill === bill ? '#e7f1ff' : 'white',
                              border: selectedRefundBill === bill ? '2px solid #0d6efd' : '1px solid #dee2e6',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <td style={{ wordBreak: 'break-all', fontSize: '0.85rem' }}>
                              <span className="fw-bold" style={{ color: selectedRefundBill === bill ? '#0d6efd' : '#333' }}>
                                {bill.billId}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              <span className="fw-bold">{bill.date}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }} className="text-end">
                              <span className="fw-bold">₹{(bill.amount || 0).toFixed(2)}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }} className="text-end">
                              <span className="text-success fw-bold">₹{(bill.discount || 0).toFixed(2)}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }} className="text-center">
                              {refundedMap[bill.billId] ? (
                                <span className="badge bg-secondary">Already refunded</span>
                              ) : (
                                <Button
                                  variant="warning"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedRefundBill(bill);
                                    // Fetch bill details and immediately open the Return Items modal
                                    handleViewBillDetails(bill.billId, bill.date, true);
                                  }}
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                >
                                  ↩️ Return
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination Controls */}
                  <div className="d-flex justify-content-between align-items-center mt-2">
                    <div>
                      <small className="text-muted">Page {refundPage + 1} of {refundTotalPages || 1}</small>
                    </div>
                    <div>
                      <Button variant="outline-secondary" size="sm" disabled={refundPage <= 0} onClick={() => handleRefundPageChange(refundPage - 1)} style={{ marginRight: '0.5rem' }}>Prev</Button>
                      <Button variant="outline-secondary" size="sm" disabled={refundTotalPages ? refundPage + 1 >= refundTotalPages : refundSearchResults.length < refundPageSize} onClick={() => handleRefundPageChange(refundPage + 1)}>Next</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reserved Items Section */}
              {selectedRefundBill && (
                <div className="mb-4">
                  {/* Bill Details Card - Show Customer Info if available */}
                  <div className="card mb-3" style={{ 
                    backgroundColor: selectedRefundBill.customerMobileNo ? '#e7f1ff' : '#fff3cd', 
                    border: selectedRefundBill.customerMobileNo ? '2px solid #0d6efd' : '1px solid #ffc107' 
                  }}>
                    <div className="card-body pb-2">
                      {selectedRefundBill.customerMobileNo && (
                        <>
                          <h6 className="fw-bold mb-3">👤 Customer Details</h6>
                          <div className="row g-2 mb-3">
                            <div className="col">
                              <small className="text-muted d-block">Mobile</small>
                              <small className="fw-bold" style={{ color: '#0d6efd', fontSize: '0.95rem' }}>
                                {selectedRefundBill.customerMobileNo}
                              </small>
                            </div>
                            <div className="col">
                              <small className="text-muted d-block">Wallet Balance</small>
                              <small className="fw-bold text-success" style={{ fontSize: '0.95rem' }}>
                                ₹{(selectedRefundBill.customerWalletBalance || 0).toFixed(2)}
                              </small>
                            </div>
                          </div>
                          <hr className="my-2" />
                        </>
                      )}
                      
                      <h6 className="fw-bold mb-3">📋 Bill Details</h6>
                      <div className="row g-2">
                        <div className="col">
                          <small className="text-muted d-block">Bill ID</small>
                          <small className="fw-bold" style={{ wordBreak: 'break-all', color: '#0d6efd', fontSize: '0.9rem' }}>
                            {selectedRefundBill.billId}
                          </small>
                        </div>
                        <div className="col">
                          <small className="text-muted d-block">Date</small>
                          <small className="fw-bold">{selectedRefundBill.date}</small>
                        </div>
                        <div className="col">
                          <small className="text-muted d-block">Amount</small>
                          <small className="fw-bold">₹{(selectedRefundBill.amount || 0).toFixed(2)}</small>
                        </div>
                        <div className="col">
                          <small className="text-muted d-block">Discount</small>
                          <small className="fw-bold text-success">₹{(selectedRefundBill.discount || 0).toFixed(2)}</small>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bill Items Preview */}
                  {billItems && billItems.length > 0 && (
                    <div className="card mb-3">
                      <div className="card-body pb-2">
                        <h6 className="fw-bold mb-2">📦 Bill Items</h6>
                        <div style={{ overflowX: 'auto' }}>
                          <table className="table table-sm mb-0" style={{ fontSize: '0.8rem' }}>
                            <thead style={{ backgroundColor: '#e9ecef' }}>
                              <tr>
                                <th style={{ fontWeight: 'bold' }}>SKU</th>
                                <th className="text-center" style={{ fontWeight: 'bold' }}>Qty</th>
                                <th className="text-end" style={{ fontWeight: 'bold' }}>Price</th>
                                <th className="text-end" style={{ fontWeight: 'bold' }}>Subtotal</th>
                                <th className="text-end" style={{ fontWeight: 'bold' }}>Discount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billItems.map((item: any, idx: number) => {
                                const itemSubtotal = (item.quantity || 0) * (item.price || 0);
                                const proportionalDiscount = billDiscount && billSubTotal 
                                  ? (billDiscount * itemSubtotal) / billSubTotal 
                                  : 0;
                                
                                return (
                                  <tr key={idx}>
                                    <td>
                                      <small className="fw-bold">{item.sku}</small>
                                    </td>
                                    <td className="text-center">
                                      <small>{item.quantity}</small>
                                    </td>
                                    <td className="text-end">
                                      <small>₹{(item.price || 0).toFixed(2)}</small>
                                    </td>
                                    <td className="text-end">
                                      <small className="fw-bold">₹{itemSubtotal.toFixed(2)}</small>
                                    </td>
                                    <td className="text-end">
                                      <small className="text-success fw-bold">-₹{proportionalDiscount.toFixed(2)}</small>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <hr className="my-2" />
                        
                        {/* Bill Summary */}
                        <div style={{ fontSize: '0.85rem' }}>
                          <div className="row g-2">
                            <div className="col-6 text-end">
                              <small className="text-muted">Subtotal:</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="fw-bold">₹{(billSubTotal || 0).toFixed(2)}</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="text-muted">Tax:</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="fw-bold">₹{(billTaxAmount || 0).toFixed(2)}</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="text-muted">Discount:</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="fw-bold text-success">-₹{(billDiscount || 0).toFixed(2)}</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="text-muted fw-bold">Total:</small>
                            </div>
                            <div className="col-6 text-end">
                              <small className="fw-bold" style={{ fontSize: '0.95rem', color: '#0d6efd' }}>
                                ₹{(billTotalAmount || 0).toFixed(2)}
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Fetch Bill Details Button */}
                  {(!billItems || billItems.length === 0) && (
                    <div className="mb-3 text-center">
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleViewBillDetails(selectedRefundBill.billId, selectedRefundBill.date)}
                      >
                        📊 View Bill Details
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {loadingReserved ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-warning mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">{t('billing.loadingReservedItems')}</p>
                </div>
              ) : reservedItems.length === 0 ? (
                <div className="alert alert-warning border-warning mt-3">
                  <h6 className="mb-3">{t('billing.noReservedItems')}</h6>
                  <p className="mb-2">{t('billing.noReservedItemsDesc')}</p>
                </div>
              ) : (
                <div className="mt-4">
                  {/* Reserved Items Grid */}
                  <div className="mb-4">
                    <h6 className="fw-bold mb-3">{t('billing.reservedItems', { count: reservedItems.length })}</h6>
                    <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
                      {reservedItems.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedReservedItem(item);
                            setReleaseQty(Math.min(1, item.quantity));
                          }}
                          style={{
                            border: selectedReservedItem === item ? '2px solid #ffc107' : '1px solid #dee2e6',
                            borderRadius: '8px',
                            padding: '0.75rem',
                            cursor: 'pointer',
                            backgroundColor: selectedReservedItem === item ? '#fff8e1' : '#f8f9fa',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333', marginBottom: '0.5rem' }}>
                            {item.sku || item.productName}
                          </div>
                          <Badge bg={selectedReservedItem === item ? 'warning' : 'secondary'}>
                            {item.quantity} units
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="my-3" />

                  {/* Release Form */}
                  <div className="mb-3">
                    <h6 className="fw-bold mb-3">{t('billing.releaseQuantity')}</h6>
                    
                    {selectedReservedItem ? (
                      <>
                        <div className="alert alert-light border border-warning mb-3" style={{ backgroundColor: '#fff8e1' }}>
                          <h6 className="fw-bold mb-2">📦 {selectedReservedItem.productName || selectedReservedItem.sku}</h6>
                          <small className="d-block mb-2">Total Reserved: {selectedReservedItem.quantity} units</small>
                          <Form.Group>
                            <Form.Label className="fw-bold">{t('billing.quantityToRelease')}</Form.Label>
                            <Form.Control
                              type="number"
                              min="1"
                              max={selectedReservedItem.quantity}
                              value={releaseQty}
                              onChange={(e) => setReleaseQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedReservedItem.quantity)))}
                            />
                          </Form.Group>
                        </div>
                      </>
                    ) : (
                      <div className="alert alert-secondary mb-3">
                        <small>{t('billing.selectReservedItem')}</small>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: REWARDS */}
          {unifiedModalTab === "rewards" && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h6 className="fw-bold mb-3">💳 Rewards</h6>
              
              {/* Find Customer Search */}
              <div className="card mb-4" style={{ backgroundColor: '#f0f7ff', border: '1px solid #0d6efd' }}>
                <div className="card-body">
                  <h6 className="fw-bold mb-3">🔍 Find Customer</h6>
                  <Form.Group className="mb-0">
                    <div className="d-flex gap-2">
                      <Form.Control
                        placeholder="Enter customer mobile number"
                        value={rewardsSearchMobile}
                        onChange={(e) => setRewardsSearchMobile(e.target.value)}
                        maxLength={10}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            searchRewardsCustomer(rewardsSearchMobile);
                          }
                        }}
                      />
                      <Button
                        variant="primary"
                        onClick={() => searchRewardsCustomer(rewardsSearchMobile)}
                        disabled={loadingRewards || !rewardsSearchMobile.trim()}
                      >
                        {loadingRewards ? '...' : '🔍'}
                      </Button>
                    </div>
                  </Form.Group>
                  {rewardsSearchError && (
                    <div className="alert alert-warning border-warning mt-2 mb-0" role="alert">
                      <small>{rewardsSearchError}</small>
                    </div>
                  )}
                </div>
              </div>

              {/* Display Results */}
              {loadingRewards && rewardsSearchedCustomer === null ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">Loading customer rewards...</p>
                </div>
              ) : rewardsSearchedCustomer ? (
                <div>
                  {/* Customer Details Card */}
                  <div className="card mb-4" style={{ backgroundColor: '#f8f9fa', border: '2px solid #28a745' }}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="fw-bold mb-1">💳 Customer Details</h6>
                          <small className="text-muted">📱 {rewardsSearchedCustomer.mobileNo || rewardsSearchMobile}</small>
                        </div>
                        <div>
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            onClick={() => {
                              setRewardsSearchedCustomer(null);
                              setRewardsSearchMobile("");
                              setWalletTransactions([]);
                              setBillTransactions([]);
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Balance Card */}
                  <div className="card mb-4" style={{ backgroundColor: '#f8f9fa', border: '2px solid #28a745' }}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <small className="text-muted d-block mb-1">💰 Wallet Balance</small>
                          <h4 className="text-success mb-0">₹{(rewardsSearchedCustomer.walletBalance || 0).toFixed(2)}</h4>
                        </div>
                        <div style={{ fontSize: '2.5rem' }}>💳</div>
                      </div>
                    </div>
                  </div>

                  {/* Wallet Transactions */}
                  <div className="mb-4">
                    <h6 className="fw-bold mb-2">📝 Wallet Transactions</h6>
                    {walletTransactions && walletTransactions.length > 0 ? (
                      <>
                        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                          <Table striped bordered hover size="sm" className="mb-0">
                            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                              <tr>
                                <th style={{ fontSize: '0.85rem', padding: '0.5rem' }}>Date</th>
                                <th style={{ fontSize: '0.85rem', padding: '0.5rem' }}>Type</th>
                                <th style={{ fontSize: '0.85rem', padding: '0.5rem' }}>Amount</th>
                                <th style={{ fontSize: '0.85rem', padding: '0.5rem' }}>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {walletTransactions.map((trans: any, idx: number) => (
                                <tr key={idx}>
                                  <td style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                                    {trans.createdAt ? new Date(trans.createdAt).toLocaleDateString() : 'N/A'}
                                  </td>
                                  <td style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                                    <Badge bg={trans.type === 'CREDIT' ? 'success' : 'danger'}>
                                      {trans.type === 'CREDIT' ? '✅ CREDIT' : '❌ DEBIT'}
                                    </Badge>
                                  </td>
                                  <td style={{ fontSize: '0.85rem', padding: '0.5rem', fontWeight: 'bold', color: trans.type === 'CREDIT' ? '#28a745' : '#dc3545' }}>
                                    {trans.type === 'CREDIT' ? '+' : '-'}₹{Math.abs(trans.amount || 0).toFixed(2)}
                                  </td>
                                  <td style={{ fontSize: '0.85rem', padding: '0.5rem' }}>
                                    {trans.description || 'Transaction'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </Table>
                        </div>
                        {/* Pagination Controls */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem' }}>
                          <small style={{ color: '#666' }}>
                            Page {walletCurrentPage + 1} of {walletTotalPages} | Total: {walletTotalElements} transactions
                          </small>
                          <div>
                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              disabled={walletCurrentPage === 0 || loadingRewards}
                              onClick={() => handleWalletPageChange(walletCurrentPage - 1)}
                              style={{ marginRight: '0.5rem' }}
                            >
                              ← Prev
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              disabled={walletCurrentPage >= walletTotalPages - 1 || loadingRewards}
                              onClick={() => handleWalletPageChange(walletCurrentPage + 1)}
                            >
                              Next →
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="alert alert-light border mb-0" style={{ backgroundColor: '#f0f0f0' }}>
                        <small className="text-muted">No wallet transactions</small>
                      </div>
                    )}
                  </div>

                  {/* Billing History */}
                  <div>
                    <h6 className="fw-bold mb-2">📊 Billing History</h6>
                    {billTransactions && billTransactions.length > 0 ? (
                      <>
                        <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                          {billTransactions.map((bill: any, idx: number) => (
                            <div key={idx} style={{
                              padding: '0.75rem',
                              borderBottom: idx < (billTransactions.length - 1) ? '1px solid #eee' : 'none',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div style={{ flex: 1, wordBreak: 'break-all' }}>
                                <small 
                                  className="fw-bold d-block" 
                                  style={{ cursor: 'pointer', color: '#0d6efd', textDecoration: 'underline' }}
                                  onClick={() => handleViewBillDetails(bill.billId, bill.date)}
                                  title="Click to view bill details"
                                >
                                  {bill.billId}
                                </small>
                                <small className="text-muted">{bill.date}</small>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <small className="d-block fw-bold">₹{(bill.amount || 0).toFixed(2)}</small>
                                {bill.discount > 0 && <small className="text-success d-block">-₹{(bill.discount || 0).toFixed(2)}</small>}
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Pagination Controls */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.5rem' }}>
                          <small style={{ color: '#666' }}>
                            Page {billCurrentPage + 1} of {billTotalPages} | Total: {billTotalElements} bills
                          </small>
                          <div>
                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              disabled={billCurrentPage === 0 || loadingRewards}
                              onClick={() => handleBillPageChange(billCurrentPage - 1)}
                              style={{ marginRight: '0.5rem' }}
                            >
                              ← Prev
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline-secondary" 
                              disabled={billCurrentPage >= billTotalPages - 1 || loadingRewards}
                              onClick={() => handleBillPageChange(billCurrentPage + 1)}
                            >
                              Next →
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="alert alert-light border mb-0" style={{ backgroundColor: '#f0f0f0' }}>
                        <small className="text-muted">No billing history</small>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="alert alert-info">
                  <h6 className="mb-2">📱 Search for a Customer</h6>
                  <small>Enter a customer's mobile number above and click the search button to view their wallet balance, transactions, and billing history.</small>
                </div>
              )}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="border-top pt-3">
          {unifiedModalTab === "payment" && (
            <>
              <Button 
                variant="outline-danger" 
                onClick={handleCancelBill}
                disabled={!billId}
                title={!billId ? t('billing.createBillFirst') : t('billing.cancelBillTooltip')}
              >
                {t('billing.cancelBill')}
              </Button>
              <Button variant="success" disabled={isPaying || !billId} onClick={async () => {
                if (!billId) { alert(t('billing.noActiveBill')); return; }
                
                const amountToPay = subtotalBeforeDiscount;
                let finalAmount = amountToPay;
                
                if (useWallet && customer) {
                  const walletBalance = customer.walletBalance || 0;
                  const walletToUse = Math.min(walletBalance, finalAmount);
                  finalAmount = Math.max(0, finalAmount - walletToUse);
                }
                
                if (paymentMode === 'CASH' && (cashReceived ?? 0) < finalAmount) {
                  alert(t('billing.cashReceivedLessThanDue', { amount: finalAmount.toFixed(2) }));
                  return;
                }
                
                await pay();
              }}>
                {isPaying ? t('billing.processing') : t('billing.payAmount', { amount: subtotalBeforeDiscount.toFixed(2) })}
              </Button>
            </>
          )}

          {unifiedModalTab === "refund" && (
            <Button
              variant="warning"
              onClick={handleReleaseItem}
              disabled={!selectedReservedItem || isReleasing || releaseQty <= 0}
            >
              {isReleasing ? 'Releasing…' : `🔓 Release (${selectedReservedItem ? releaseQty : 0} units)`}
            </Button>
          )}

          <Button 
            variant="secondary" 
            onClick={() => setShowUnifiedControlsModal(false)}
          >
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Refund Slip Modal */}
      <Modal show={showRefundSlip} onHide={() => { setShowRefundSlip(false); setRefundSlipData(null); }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Refund Slip - {refundSlipData?.billId || ''}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {refundSlipData ? (
            <div id="refund-slip-content">
              <h5>Refund Slip</h5>
              <div className="small text-muted">Bill: {refundSlipData.billId}</div>
              <div className="small text-muted">Date: {refundSlipData.date}</div>
              <Table size="sm" className="mt-2">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Gross</th></tr>
                </thead>
                <tbody>
                  {refundSlipData.items.map((it: any, i: number) => (
                    <tr key={i}><td>{it.sku}</td><td>{it.qty}</td><td>₹{it.unitPrice.toFixed(2)}</td><td>₹{it.gross.toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-3">
                <div className="d-flex justify-content-between"><div>Total Gross</div><div>₹{refundSlipData.totals.totalGross.toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>Wallet Credit</div><div>₹{(refundSlipData.totals.walletCredit || 0).toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>Discount Reversed (wallet)</div><div>₹{(refundSlipData.totals.discountReversed || 0).toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>Cash/Card Refund</div><div>₹{(refundSlipData.totals.cashRefund || 0).toFixed(2)}</div></div>
                <hr />
                <div className="d-flex justify-content-between fw-bold"><div>Net Wallet Change</div><div>₹{(refundSlipData.totals.netWalletChange || 0).toFixed(2)}</div></div>
              </div>
            </div>
          ) : (
            <div>No refund data available</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowRefundSlip(false); setRefundSlipData(null); }}>Close</Button>
          <Button variant="primary" onClick={() => {
            const content = document.getElementById('refund-slip-content');
            if (!content) return;
            const w = window.open('', '_blank', 'width=600,height=800');
            if (!w) { alert('Unable to open print window'); return; }
            w.document.write('<html><head><title>Refund Slip</title><style>body{font-family:sans-serif;padding:12px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>');
            w.document.write(content.innerHTML);
            w.document.write('</body></html>');
            w.document.close();
            w.focus();
            setTimeout(() => { w.print(); }, 300);
          }}>Print</Button>
        </Modal.Footer>
      </Modal>

      {/* Receipt Modal */}
      <Modal show={showReceiptModal} onHide={() => { setShowReceiptModal(false); setBillId(undefined); setReceiptData(null); setShowUnifiedControlsModal(false); if (barcodeRef.current) barcodeRef.current.value = ""; scannerBufferRef.current = ""; scannerLastTimeRef.current = null; }} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{t('billing.receiptTitle', { billId: receiptData?.billId || '' })}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {receiptData ? (
            <div id="receipt-content">
              <h5>{t('billing.storeReceipt')}</h5>
              <div className="small text-muted">{t('billing.billLabel', { billId: receiptData.billId })}</div>
              <Table size="sm" className="mt-2">
                <thead>
                  <tr><th>{t('billing.table.item')}</th><th>{t('billing.table.qty')}</th><th>{t('billing.table.price')}</th><th>{t('billing.table.discount')}</th><th>{t('billing.table.total')}</th></tr>
                </thead>
                <tbody>
                  {receiptData.items.map((it: any) => {
                    const discountPerUnit = it.discountAmount ?? 0;
                    const totalDiscount = discountPerUnit * it.qty;
                    const priceAfterDiscount = Math.max(0, (it.price ?? 0) - discountPerUnit);
                    const receiptItemTotal = priceAfterDiscount * it.qty;
                    return (
                      <tr key={`${it.productId}-${it.batchNo}`}>
                        <td>{it.sku || it.name}</td>
                        <td>{it.qty}</td>
                        <td>₹{it.price.toFixed(2)}</td>
                        <td>₹{totalDiscount.toFixed(2)}</td>
                        <td>₹{receiptItemTotal.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>

              <div className="mt-3">
                <div className="d-flex justify-content-between"><div>{t('billing.subtotal')}</div><div>₹{(receiptData.totals.discountAmt + receiptData.totals.taxable).toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>{t('billing.discountLabel')}</div><div>₹{receiptData.totals.discountAmt.toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>{t('billing.gst')}</div><div>₹{receiptData.totals.gstAmt.toFixed(2)}</div></div>
                <hr />
                <div className="d-flex justify-content-between fw-bold"><div>{t('billing.grandTotal')}</div><div>₹{receiptData.totals.grandTotal.toFixed(2)}</div></div>
                
                {/* Show wallet usage if applicable */}
                {receiptData.walletUsed && receiptData.walletUsed > 0 && (
                  <>
                    <hr className="my-2" />
                    <div className="d-flex justify-content-between p-2 text-success fw-bold">
                      <div className="small">💳 Wallet Used</div>
                      <div className="small">-₹{receiptData.walletUsed.toFixed(2)}</div>
                    </div>
                  </>
                )}
                
                {/* Show final amount due */}
                {receiptData.amountToCharge !== undefined && (
                  <div className="d-flex justify-content-between bg-warning bg-opacity-10 p-2 rounded mt-2">
                    <div className="fw-bold">Amount Due</div>
                    <div className="fw-bold">₹{receiptData.amountToCharge.toFixed(2)}</div>
                  </div>
                )}
              </div>

              {receiptData.payment?.customerMobile && (
                <div className="mt-3 p-2 bg-light rounded">
                  <div className="small text-success fw-bold">{t('billing.walletCreated')}</div>
                  <div className="small">{t('billing.walletMobile')}: {receiptData.payment.customerMobile}</div>
                  <div className="small">{t('billing.discountCredited', { amount: receiptData.payment.discount?.toFixed(2) || '0.00' })}</div>
                  <div className="small text-muted">{t('billing.useWalletFuture')}</div>
                </div>
              )}
            </div>
          ) : (
            <div>{t('billing.noReceiptData')}</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => { setShowReceiptModal(false); setBillId(undefined); setReceiptData(null); setShowUnifiedControlsModal(false); if (barcodeRef.current) barcodeRef.current.value = ""; scannerBufferRef.current = ""; scannerLastTimeRef.current = null; }}>Close</Button>
          <Button variant="primary" onClick={() => {
            // print receipt
            const content = document.getElementById('receipt-content');
            if (!content) return;
            const w = window.open('', '_blank', 'width=600,height=800');
            if (!w) { alert(t('billing.unableToOpenPrintWindow')); return; }
            w.document.write('<html><head><title>Receipt</title><style>body{font-family:sans-serif;padding:12px}table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #ddd;padding:6px;text-align:left}</style></head><body>');
            w.document.write(content.innerHTML);
            w.document.write('</body></html>');
            w.document.close();
            w.focus();
            setTimeout(() => { w.print(); }, 300);
          }}>Print</Button>
          <Button variant="success" onClick={async () => {
            // done: close receipt and reset UI. Do NOT auto-create a new bill — user must click Start Billing.
            setShowReceiptModal(false);
            setReceiptData(null);
            setCart([]);
            setDiscount(0);
            setDiscountIsPercent(false);
            setCashReceived(undefined);
            setCustomerMobile('');
            setReservedForBill(false);
            setBillId(undefined);
            // ensure billing controls are closed and scanner state reset
            setShowUnifiedControlsModal(false);
            if (barcodeRef.current) barcodeRef.current.value = "";
            scannerBufferRef.current = "";
            scannerLastTimeRef.current = null;
          }}>{t('billing.done')}</Button>
        </Modal.Footer>
      </Modal>

      {/* Cancel Bill Confirmation Modal */}
      <Modal show={showCancelConfirmModal} onHide={() => setShowCancelConfirmModal(false)} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Cancel Bill</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="alert alert-warning mb-3">
            <strong>{t('billing.cancelBillConfirm')}</strong>
          </div>
          <p>{t('billing.cancelBillWill')}</p>
          <ul>
            <li>{t('billing.cancelBillList.release')}</li>
            <li>{t('billing.cancelBillList.cancelSession')}</li>
            <li>{t('billing.cancelBillList.allowRestart')}</li>
          </ul>
          <p className="text-muted mb-0">{t('billing.cannotUndo')}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setShowCancelConfirmModal(false)}
            disabled={isCancelling}
          >
            {t('billing.keepBill')}
          </Button>
          <Button 
            variant="danger" 
            onClick={confirmCancelBill}
            disabled={isCancelling}
          >
            {isCancelling ? t('billing.cancelling') : t('billing.cancelBill')}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* OLD Release/Refund Modal - DEPRECATED (consolidated into Unified Controls Modal) */}
      {false && <Modal show={showReleaseModal} onHide={() => setShowReleaseModal(false)} size="lg" scrollable>
        <Modal.Header closeButton className="bg-warning bg-opacity-10">
          <Modal.Title className="fw-bold">🔄 Refund - Release Reserved Items</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingReserved ? (
            <div className="text-center p-5">
              <div className="spinner-border text-warning mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted">Loading reserved items...</p>
            </div>
          ) : reservedItems.length === 0 ? (
            <div className="alert alert-warning border-warning">
              <h6 className="mb-3">📋 No Reserved Items Found</h6>
              <p className="mb-2">There are currently no reserved items available for refund.</p>
              <hr className="my-3" />
              <p className="small mb-0">
                <strong>How to Create Reservations:</strong><br/>
                ✓ Add items to cart<br/>
                ✓ Click "Pay" button<br/>
                ✓ Complete the payment<br/>
                ✓ Items will be reserved in the system<br/>
                ✓ Then you can refund them here
              </p>
            </div>
          ) : (
            <div>
              {/* Reserved Items Grid - Similar to AdminInventoryRelease */}
              <div className="mb-4">
                <h6 className="fw-bold mb-3">📋 Reserved Items ({reservedItems.length})</h6>
                <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {reservedItems.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => {
                        setSelectedReservedItem(item);
                        setReleaseQty(Math.min(1, item.quantity));
                      }}
                      style={{
                        border: selectedReservedItem === item ? '2px solid #ffc107' : '1px solid #dee2e6',
                        borderRadius: '8px',
                        padding: '0.75rem',
                        cursor: 'pointer',
                        backgroundColor: selectedReservedItem === item ? '#fff8e1' : '#f8f9fa',
                        transition: 'all 0.2s ease',
                        boxShadow: selectedReservedItem === item ? '0 0 8px rgba(255, 193, 7, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedReservedItem !== item) {
                          e.currentTarget.style.backgroundColor = '#f0f0f0';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedReservedItem !== item) {
                          e.currentTarget.style.backgroundColor = '#f8f9fa';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#333' }}>
                          {item.sku || item.productName}
                        </span>
                        <Badge bg={selectedReservedItem === item ? 'warning' : 'secondary'} text={selectedReservedItem === item ? 'dark' : 'white'}>
                          {item.quantity} units
                        </Badge>
                      </div>
                      
                      {item.productName && item.sku && (
                        <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: '0.4rem' }}>
                          {item.productName}
                        </div>
                      )}
                      
                      <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.4rem' }}>
                        <strong>Ref ID:</strong> {item.referenceId}
                      </div>
                      
                      {item.reservedDate && (
                        <div style={{ fontSize: '0.75rem', color: '#999' }}>
                          Reserved: {new Date(item.reservedDate).toLocaleDateString()}
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <Button
                          variant={selectedReservedItem === item ? 'warning' : 'outline-warning'}
                          size="sm"
                          className="flex-grow-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReservedItem(item);
                            setReleaseQty(Math.min(1, item.quantity));
                          }}
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                        >
                          {selectedReservedItem === item ? '✓ Selected' : 'Select'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <hr className="my-4" />

              {/* Release Form - Like AdminInventoryRelease */}
              <div className="mb-3">
                <h6 className="fw-bold mb-3">🔓 Release Form</h6>
                
                {reservedItems.length > 0 && (
                  <div className="alert alert-info alert-sm mb-3" style={{ fontSize: '0.85rem' }}>
                    <span style={{ marginRight: '0.5rem' }}>💡</span>
                    Click on a reserved item above to select it, or use the dropdown below
                  </div>
                )}

                {selectedReservedItem ? (
                  <>
                    {/* Selected Item Details */}
                    <div className="alert alert-light border border-warning mb-3" style={{ backgroundColor: '#fff8e1' }}>
                      <h6 className="fw-bold mb-2">📦 Selected Item Details</h6>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                        {selectedReservedItem?.sku && (
                          <>
                            <div><strong>SKU:</strong></div>
                            <div>{selectedReservedItem?.sku}</div>
                          </>
                        )}
                        {selectedReservedItem?.productName && (
                          <>
                            <div><strong>Product:</strong></div>
                            <div>{selectedReservedItem?.productName}</div>
                          </>
                        )}
                        <div><strong>Reference ID:</strong></div>
                        <div className="text-monospace">{selectedReservedItem?.referenceId}</div>
                        <div><strong>Total Reserved:</strong></div>
                        <div>{selectedReservedItem?.quantity} units</div>
                        {selectedReservedItem?.reservedDate && (
                          <>
                            <div><strong>Reserved Date:</strong></div>
                            <div>{new Date(selectedReservedItem?.reservedDate || '').toLocaleDateString()}</div>
                          </>
                        )}
                      </div>

                      <Form.Group className="mt-3">
                        <Form.Label className="fw-bold">Quantity to Release *</Form.Label>
                        <Form.Control
                          type="number"
                          min="1"
                          max={selectedReservedItem?.quantity || 0}
                          value={releaseQty}
                          onChange={(e) => setReleaseQty(Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedReservedItem?.quantity || 0)))}
                          className="form-control-lg"
                        />
                        <small className="text-muted">
                          Available: {selectedReservedItem?.quantity} units
                        </small>
                      </Form.Group>
                    </div>
                  </>
                ) : (
                  <div className="alert alert-secondary mb-3">
                    <small>Please select a reserved item from the list above</small>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-top pt-3">
          <Button variant="secondary" onClick={() => setShowReleaseModal(false)}>
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={handleReleaseItem}
            disabled={!selectedReservedItem || isReleasing || releaseQty <= 0}
            size="lg"
          >
            {isReleasing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Releasing…
              </>
            ) : (
              <>� Release Item ({selectedReservedItem ? releaseQty : 0} units)</>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      }

      {/* Bill Details Modal */}
      <Modal show={showBillDetailsModal} onHide={() => setShowBillDetailsModal(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>📋 Bill Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingBillDetails ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary mb-3" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-muted">Loading bill details...</p>
            </div>
          ) : (
            <div>
              {/* Bill Header Info */}
              <div className="card mb-4" style={{ backgroundColor: '#f0f7ff', border: '1px solid #0d6efd' }}>
                <div className="card-body">
                  <div className="row">
                    <div className="col-md-6">
                      <small className="text-muted d-block">Bill ID</small>
                      <h6 className="fw-bold" style={{ wordBreak: 'break-all' }}>{selectedBillId}</h6>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Date</small>
                      <h6 className="fw-bold">{selectedBillDate}</h6>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill Summary / Totals */}
              <div className="card mb-4" style={{ backgroundColor: '#f9f9f9', border: '1px solid #ddd' }}>
                <div className="card-body">
                  <h6 className="fw-bold mb-3">💰 Bill Summary</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <small className="text-muted d-block">Subtotal</small>
                      <h6 className="fw-bold">₹{billSubTotal.toFixed(2)}</h6>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Tax</small>
                      <h6 className="fw-bold">₹{billTaxAmount.toFixed(2)}</h6>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Discount</small>
                      <h6 className="fw-bold text-success" style={{ color: '#28a745' }}>-₹{billDiscount.toFixed(2)}</h6>
                    </div>
                    <div className="col-md-6">
                      <small className="text-muted d-block">Total Amount</small>
                      <h6 className="fw-bold" style={{ color: '#0d6efd', fontSize: '1.1rem' }}>₹{billTotalAmount.toFixed(2)}</h6>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bill Items Table */}
              <h6 className="fw-bold mb-3">📦 Items in Bill</h6>
              {billItems && billItems.length > 0 ? (
                <div style={{ border: '1px solid #ddd', borderRadius: '4px', overflowX: 'auto' }}>
                  <Table striped bordered hover className="mb-0">
                    <thead className="table-light">
                      <tr>
                        <th>SKU</th>
                        <th>Product Name</th>
                        <th>Qty</th>
                        <th>Price</th>
                        <th>Discount</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billItems.map((item: any, idx: number) => {
                        const itemSubtotal = (item.price || 0) * (item.qty || item.quantity || 0);
                        // Calculate proportional discount for this item
                        const itemDiscount = billSubTotal > 0 ? (billDiscount * itemSubtotal) / billSubTotal : 0;
                        const itemTotal = itemSubtotal - itemDiscount;
                        
                        return (
                          <tr key={idx}>
                            <td>
                              <small className="fw-bold">{item.sku || 'N/A'}</small>
                            </td>
                            <td>
                              <small>{item.name || item.productName || 'N/A'}</small>
                            </td>
                            <td className="text-center">
                              <small className="fw-bold">{item.qty || item.quantity || 0}</small>
                            </td>
                            <td className="text-end">
                              <small>₹{(item.price || 0).toFixed(2)}</small>
                            </td>
                            <td className="text-end">
                              <small className="text-danger">
                                {itemDiscount > 0 ? '-₹' + (itemDiscount).toFixed(2) : '-'}
                              </small>
                            </td>
                            <td className="text-end">
                              <small className="fw-bold">
                                    ₹{(itemTotal).toFixed(2)}
                              </small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <div className="alert alert-light border" style={{ backgroundColor: '#f0f0f0' }}>
                  <small className="text-muted">No items found in this bill</small>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          {billRefunded && (
            <Alert variant="warning" className="w-100 mb-0">
              ⚠️ This bill has already been refunded. Cannot process return again.
            </Alert>
          )}
          <Button 
            variant="danger" 
            disabled={billRefunded}
            onClick={() => {
              setReturnItemSelection({});
              setReturnError(null);
              setShowReturnItemModal(true);
            }}
          >
            ↩️ Process Return
          </Button>
          <Button variant="secondary" onClick={() => setShowBillDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Return Items Modal */}
      <Modal show={showReturnItemModal} onHide={() => setShowReturnItemModal(false)} size="lg" scrollable centered>
        <Modal.Header closeButton>
          <Modal.Title>↩️ Return Items from Bill {selectedRefundBill?.billId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {returnError && <Alert variant="danger">{returnError}</Alert>}

          <div className="mb-3">
            <h6 className="fw-bold mb-3">Select items to return:</h6>
            
            {billItems && billItems.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table className="table table-sm table-hover">
                  <thead style={{ backgroundColor: '#e9ecef' }}>
                    <tr>
                      <th style={{ fontWeight: 'bold', width: '10%' }}>Select</th>
                      <th style={{ fontWeight: 'bold' }}>SKU</th>
                      <th className="text-center" style={{ fontWeight: 'bold' }}>Ordered</th>
                      <th className="text-center" style={{ fontWeight: 'bold' }}>Return</th>
                      <th className="text-end" style={{ fontWeight: 'bold' }}>Price</th>
                      <th className="text-end" style={{ fontWeight: 'bold' }}>Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billItems.map((item: any, idx: number) => {
                      const returnQty = returnItemSelection[idx] || 0;
                      const itemSubtotal = (item.quantity || 0) * (item.price || 0);
                      const proportionalDiscount = billDiscount && billSubTotal 
                        ? (billDiscount * itemSubtotal) / billSubTotal 
                        : 0;
                      const itemTotal = itemSubtotal - proportionalDiscount;
                      const refundAmount = (itemTotal * returnQty) / (item.quantity || 1);

                      return (
                        <tr key={idx}>
                          <td className="text-center">
                            <Form.Check
                              type="checkbox"
                              checked={idx in returnItemSelection}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setReturnItemSelection(prev => ({ ...prev, [idx]: 1 }));
                                } else {
                                  setReturnItemSelection(prev => {
                                    const copy = { ...prev };
                                    delete copy[idx];
                                    return copy;
                                  });
                                }
                              }}
                            />
                          </td>
                          <td>
                            <small className="fw-bold">{item.sku}</small>
                          </td>
                          <td className="text-center">
                            <small>{item.quantity}</small>
                          </td>
                          <td className="text-center">
                            {idx in returnItemSelection ? (
                              <InputGroup size="sm">
                                <Form.Control
                                  type="number"
                                  min="1"
                                  max={item.quantity}
                                  value={returnQty}
                                  onChange={(e) => {
                                    const val = Math.min(parseInt(e.target.value) || 0, item.quantity);
                                    if (val > 0) {
                                      setReturnItemSelection(prev => ({ ...prev, [idx]: val }));
                                    }
                                  }}
                                  style={{ width: '60px' }}
                                />
                              </InputGroup>
                            ) : (
                              <small className="text-muted">-</small>
                            )}
                          </td>
                          <td className="text-end">
                            <small>₹{(item.price || 0).toFixed(2)}</small>
                          </td>
                          <td className="text-end">
                            <small className="text-success fw-bold">
                              {returnQty > 0 ? `₹${refundAmount.toFixed(2)}` : '₹0.00'}
                            </small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="alert alert-light border">
                <small className="text-muted">No items found</small>
              </div>
            )}
          </div>

          {/* Refund Summary */}
          {Object.keys(returnItemSelection).length > 0 && (
            <div className="card mb-3">
              <div className="card-body pb-2">
                <h6 className="fw-bold mb-2">💰 Refund Summary</h6>
                {billItems.map((item: any, idx: number) => {
                  const returnQty = returnItemSelection[idx];
                  if (!returnQty || returnQty <= 0) return null;

                  // Show gross refund (price × qty) in the UI; discount reversal handled separately
                  const refundAmountGross = (item.price || 0) * (returnQty || 0);

                  return (
                    <div key={idx} className="row g-2 mb-2" style={{ fontSize: '0.85rem' }}>
                      <div className="col-6">
                        <small>{item.sku} ({returnQty} × ₹{item.price})</small>
                      </div>
                      <div className="col-6 text-end">
                        <small className="fw-bold text-success">₹{refundAmountGross.toFixed(2)}</small>
                      </div>
                    </div>
                  );
                })}
                
                <hr className="my-2" />
                
                <div className="row g-2">
                  <div className="col-6">
                    <small className="fw-bold">Total Refund:</small>
                  </div>
                  <div className="col-6 text-end">
                    <small className="fw-bold" style={{ fontSize: '1rem', color: '#28a745' }}>
                      ₹{Object.entries(returnItemSelection)
                        .reduce((sum, [idx, qty]) => {
                          if (!qty || qty <= 0) return sum;
                          const item = billItems[parseInt(idx)];
                          const refundAmountGross = (item.price || 0) * (qty || 0);
                          return sum + refundAmountGross;
                        }, 0).toFixed(2)}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="success" 
            disabled={Object.values(returnItemSelection).reduce((sum, qty) => sum + qty, 0) === 0 || processingReturn}
            onClick={handleReturnItems}
          >
            {processingReturn ? '⏳ Processing...' : '✅ Confirm Return'}
          </Button>
          <Button 
            variant="secondary" 
            disabled={processingReturn}
            onClick={() => setShowReturnItemModal(false)}
          >
            Cancel
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Payment Method Selection Modal for Return */}
      <Modal show={showPaymentMethodModal} onHide={() => setShowPaymentMethodModal(false)} centered backdrop="static">
        <Modal.Header>
          <Modal.Title>💳 Original Payment Method</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {returnError && <Alert variant="danger">{returnError}</Alert>}

          <div className="mb-4">
            <h6 className="fw-bold mb-3">Original Payment Method</h6>
            <small className="text-muted d-block mb-2">Select or confirm the payment method used:</small>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Form.Check
              type="radio"
              id="payment_cash"
              label="💵 All Cash"
              name="paymentMethod"
              value="cash"
              checked={paymentMethodType === 'cash'}
              disabled={!!fetchedBillSummary && !allowManualPaymentMethodEdit}
              onChange={() => {
                setPaymentMethodType('cash');
                setWalletAmountUsed(0);
                setWalletAmountInput('');
              }}
              className="mb-2"
            />
            {fetchedBillSummary && (
              <small className="text-muted">(from API)</small>
            )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Form.Check
              type="radio"
              id="payment_wallet"
              label="💳 All Wallet"
              name="paymentMethod"
              value="wallet"
              checked={paymentMethodType === 'wallet'}
              disabled={!!fetchedBillSummary && !allowManualPaymentMethodEdit}
              onChange={() => {
                setPaymentMethodType('wallet');
                setWalletAmountUsed(billTotalAmount || 0);
                setWalletAmountInput(String(billTotalAmount || 0));
              }}
              className="mb-2"
            />
            {fetchedBillSummary && (
              <small className="text-muted">(from API)</small>
            )}
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Form.Check
              type="radio"
              id="payment_mixed"
              label="🔄 Mixed (Cash + Wallet)"
              name="paymentMethod"
              value="mixed"
              checked={paymentMethodType === 'mixed'}
              disabled={!!fetchedBillSummary && !allowManualPaymentMethodEdit}
              onChange={() => setPaymentMethodType('mixed')}
              className="mb-3"
            />
            {fetchedBillSummary && (
              <small className="text-muted">(from API)</small>
            )}
            </div>

            {paymentMethodType === 'mixed' && (
              <div className="card mt-3 p-3" style={{ backgroundColor: '#f0f8ff' }}>
                <small className="text-muted mb-2">Enter the amount paid from wallet:</small>
                <InputGroup size="sm">
                  <InputGroup.Text>₹</InputGroup.Text>
                  <Form.Control
                    type="number"
                    min="0"
                    max={billTotalAmount || 0}
                    step="0.01"
                    placeholder="0.00"
                    value={walletAmountInput}
                    onChange={(e) => {
                      setWalletAmountInput(e.target.value);
                      setWalletAmountUsed(parseFloat(e.target.value) || 0);
                    }}
                    disabled={!!fetchedBillSummary && !allowManualPaymentMethodEdit}
                  />
                </InputGroup>
                <small className="text-muted mt-2 d-block">
                  Bill Total: ₹{(billTotalAmount || 0).toFixed(2)}
                </small>
              </div>
            )}

            {fetchedBillSummary && !allowManualPaymentMethodEdit && (
              <div className="mt-2">
                <Button variant="link" size="sm" onClick={() => setAllowManualPaymentMethodEdit(true)}>Edit</Button>
                <small className="text-muted ms-2">You can edit the payment method if needed.</small>
              </div>
            )}
          </div>

          <hr />

          {billDiscount > 0 && (
            <div className="mb-3">
              <h6 className="fw-bold mb-3">Discount Handling</h6>
              <small className="text-muted d-block mb-2">
                This bill had a discount of <span className="fw-bold text-success">₹{billDiscount.toFixed(2)}</span>
              </small>
              
              <Form.Check
                type="radio"
                id="discount_yes"
                label="✅ Revert discount from wallet (recommended)"
                name="discountReversal"
                value="yes"
                checked={discountReversalOption === 'yes'}
                onChange={() => setDiscountReversalOption('yes')}
                className="mb-2"
              />
              
              <Form.Check
                type="radio"
                id="discount_no"
                label="❌ Keep discount (no revert)"
                name="discountReversal"
                value="no"
                checked={discountReversalOption === 'no'}
                onChange={() => setDiscountReversalOption('no')}
              />
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="success"
            disabled={paymentMethodType === 'mixed' && (walletAmountUsed <= 0 || walletAmountUsed > (billTotalAmount || 0))}
            onClick={handleProcessRefundWithPaymentMethod}
          >
            ✅ Continue with Return
          </Button>
          <Button 
            variant="secondary"
            onClick={() => {
              setShowPaymentMethodModal(false);
              setReturnError(null);
            }}
          >
            Back
          </Button>
        </Modal.Footer>
      </Modal>

      {/* OLD Inventory Check Modal - DEPRECATED (consolidated into Unified Controls Modal) */}
      {false && <Modal show={showInventoryModal} onHide={() => setShowInventoryModal(false)} size="lg" scrollable>
        <Modal.Header closeButton>
          <Modal.Title>📦 Inventory Check</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!inventoryLoaded ? (
            <div className="text-center py-5">
              <p style={{ marginBottom: '1.5rem', fontSize: '1rem', color: '#666' }}>
                Click the button below to load inventory data
              </p>
              <Button
                variant="primary"
                size="lg"
                onClick={loadInventoryForModal}
                disabled={loadingInventory}
              >
                {loadingInventory ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                    Loading Inventory...
                  </>
                ) : (
                  '📦 Load Inventory Data'
                )}
              </Button>
            </div>
          ) : (
            <>
          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            {/* Category Dropdown */}
            <div style={{ flex: 1, minWidth: '140px' }}>
              <Form.Select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedBrand("");
                }}
                size="sm"
              >
                <option value="">All Categories</option>
                {categories.map((cat: string) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </Form.Select>
            </div>

            {/* Brand Dropdown */}
            <div style={{ flex: 1, minWidth: '140px' }}>
              <Form.Select
                value={selectedBrand}
                onChange={(e) => {
                  setSelectedBrand(e.target.value);
                }}
                size="sm"
              >
                <option value="">All Brands</option>
                {brands
                  .filter((brand: string) =>
                    !selectedCategory ||
                    inventoryData.some((p: any) => p.brandName === brand && p.category === selectedCategory)
                  )
                  .map((brand: string) => (
                    <option key={brand} value={brand}>{brand}</option>
                  ))}
              </Form.Select>
            </div>

            {(selectedCategory || selectedBrand) && (
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setSelectedCategory("");
                  setSelectedBrand("");
                }}
                style={{ whiteSpace: 'nowrap' }}
              >
                Clear Filters
              </Button>
            )}
          </div>

          {loadingInventory ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">{t('billing.loadingInventory')}</p>
            </div>
          ) : !selectedCategory || !selectedBrand ? (
            <div className="text-center text-muted py-5">
              <p style={{ fontSize: '0.95rem' }}>
                {!selectedCategory ? t('billing.selectCategory') : t('billing.selectBrand')}
              </p>
            </div>
          ) : filterLoadingDelay ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-3">Loading filtered results...</p>
            </div>
          ) : (() => {
            const filteredInventory = inventoryData.filter((product: any) =>
              product.category === selectedCategory &&
              product.brandName === selectedBrand
            );
            
            return filteredInventory.length === 0 ? (
              <div className="text-center text-muted py-5">
                <p>{inventoryData.length === 0 ? 'No inventory items found' : 'No matching items for selected filters'}</p>
              </div>
            ) : (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {filteredInventory
                  .map((product: any) => (
                <div key={product.productId} style={{ 
                  borderBottom: '1px solid #e0e0e0', 
                  padding: '0.75rem',
                  marginBottom: '0.5rem',
                  borderRadius: '6px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <h6 style={{ margin: '0 0 0.15rem 0', fontWeight: 'bold', fontSize: '0.95rem' }}>{product.productName}</h6>
                      <small style={{ color: '#666', fontSize: '0.8rem' }}>SKU: {product.productSku}</small>
                    </div>
                    <Badge bg="primary" style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                      {product.totalQty}
                    </Badge>
                  </div>

                  {/* Barcode Section */}
                  {product.barcode && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '0.4rem',
                      backgroundColor: '#fff',
                      borderRadius: '4px',
                      marginBottom: '0.5rem',
                      border: '1px solid #ddd'
                    }}>
                      <img
                        src={`data:image/png;base64,${product.barcode}`}
                        alt="barcode"
                        style={{
                          maxWidth: '100px',
                          height: 'auto',
                          cursor: 'pointer',
                          transition: 'transform 0.2s ease'
                        }}
                        onClick={() => { setBarcodePreview(product.barcode); setShowBarcodePreviewModal(true); }}
                        title="Click to preview barcode"
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                      />
                      <div style={{ fontSize: '0.7rem', color: '#999', marginTop: '0.15rem' }}>
                        Click to view
                      </div>
                    </div>
                  )}
                  
                  {product.batches && product.batches.length > 0 ? (
                    <div style={{ marginTop: '0.5rem' }}>
                      <small style={{ fontWeight: '600', color: '#333', display: 'block', marginBottom: '0.4rem', fontSize: '0.8rem' }}>Batches:</small>
                      {product.batches.map((batch: any, idx: number) => {
                        const today = new Date();
                        const expiry = new Date(batch.expiry);
                        const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                        let expiryStatus = 'Valid';
                        let badgeColor = 'success';
                        
                        if (daysLeft < 0) {
                          expiryStatus = 'Expired';
                          badgeColor = 'danger';
                        } else if (daysLeft <= 30) {
                          expiryStatus = `Near Expiry (${daysLeft}d)`;
                          badgeColor = 'warning';
                        }
                        
                        const isLowStock = batch.qty <= 20;
                        
                        return (
                          <div key={idx} style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.35rem 0.4rem',
                            backgroundColor: '#fff',
                            marginBottom: '0.3rem',
                            borderRadius: '4px',
                            border: '1px solid #ddd'
                          }}>
                            <div style={{ flex: 1 }}>
                              <small style={{ fontWeight: '500', fontSize: '0.75rem' }}>{t('billing.batchLabel')} {batch.batchNo}</small>
                              <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.1rem' }}>
                                {t('billing.batchExpiry')}: {new Date(batch.expiry).toLocaleDateString()}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                              <Badge bg={isLowStock ? 'danger' : 'success'} style={{ padding: '0.25rem 0.4rem', fontSize: '0.65rem' }}>
                                {batch.qty}
                              </Badge>
                              <Badge bg={badgeColor} style={{ padding: '0.25rem 0.4rem', fontSize: '0.65rem' }}>
                                {expiryStatus}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <small style={{ color: '#999', fontStyle: 'italic' }}>No batches available</small>
                  )}
                </div>
                ))}
              </div>
            );
          })()}
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowInventoryModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
      }

      {/* Barcode Preview Modal */}
      <Modal show={showBarcodePreviewModal} onHide={() => setShowBarcodePreviewModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Barcode Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {barcodePreview ? (
            <>
              <img 
                src={`data:image/png;base64,${barcodePreview}`} 
                alt="barcode" 
                style={{ maxWidth: '100%', height: 'auto' }} 
              />
              <div style={{ marginTop: '1rem' }}>
                <a 
                  href={`data:image/png;base64,${barcodePreview}`} 
                  download="barcode.png" 
                  className="btn btn-outline-primary btn-sm"
                >
                  📥 Download
                </a>
              </div>
            </>
          ) : (
            <div className="text-muted">No preview available</div>
          )}
        </Modal.Body>
      </Modal>

        {/* Batch Allocation Modal — only used for Split action */}
        <Modal show={showBatchAllocModal} onHide={() => setShowBatchAllocModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>Choose Batch / Quantity</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {batchOptions && batchOptions.length > 0 ? (
              <div>
                <div className="mb-2 small text-muted">Select batch</div>
                <div className="d-flex align-items-center mb-2">
                  <div style={{ width: 160 }} className="me-2">
                    <Form.Label>Total Quantity</Form.Label>
                    <Form.Control type="number" min={1} value={batchModalTotalQty} onChange={e => setBatchModalTotalQty(Number(e.target.value) || 0)} />
                  </div>
                  <div style={{ marginTop: 22 }}>
                    <Button size="sm" variant="outline-primary" onClick={() => distributeSelectedBatches(batchModalTotalQty)}>Auto-distribute</Button>
                  </div>
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {batchOptions.map((b: any, idx: number) => {
                    const bNo = b.batchNo ?? String(b.id ?? '');
                    const checked = batchModalSelectedBatches.includes(bNo);
                    return (
                      <div key={idx} className="d-flex align-items-center mb-2">
                        <div className="form-check me-2">
                          <input className="form-check-input" type="checkbox" name="batchSelect" id={`batch-${idx}`} checked={checked} onChange={() => {
                            setBatchModalSelectedBatches(prev => checked ? prev.filter(x=>x!==bNo) : [...prev, bNo]);
                          }} />
                        </div>
                        <label className="form-check-label flex-grow-1" htmlFor={`batch-${idx}`} style={{ marginRight: '8px' }}>
                          {bNo} — {b.availableQty ?? 0} units {b.expiryDate ? `— Exp: ${new Date(b.expiryDate).toLocaleDateString()}` : ''}
                        </label>
                        <div style={{ width: 100 }}>
                          <Form.Control type="number" min={1} value={batchModalQtyMap[bNo] ?? 1} onChange={e => setBatchModalQtyMap(prev => ({ ...prev, [bNo]: Number(e.target.value) }))} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Per-batch quantities are provided next to each batch */}
              </div>
            ) : (
              <div className="text-center text-muted">No batch information available</div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBatchAllocModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={applyBatchSelection}>Add</Button>
          </Modal.Footer>
        </Modal>
            <VoiceAssistant onIntent={handleVoiceIntent} />
        </div>
  );
};

export default Billing;
