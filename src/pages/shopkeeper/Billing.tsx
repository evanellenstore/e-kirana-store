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
import {
  startBill,
  getProductBySku,
  getBatches,
  addItemsBatch,
  finalizeBill,
  cancelBill,
  getSummary,
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

  // Release/Refund state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [reservedItems, setReservedItems] = useState<ReservedItem[]>([]);
  const [loadingReserved, setLoadingReserved] = useState(false);
  const [selectedReservedItem, setSelectedReservedItem] = useState<ReservedItem | null>(null);
  const [releaseQty, setReleaseQty] = useState<number>(1);
  const [isReleasing, setIsReleasing] = useState(false);

  // Inventory Check Modal state
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryData, setInventoryData] = useState<any[]>([]);
  const [loadingInventory, setLoadingInventory] = useState(false);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [showBarcodePreviewModal, setShowBarcodePreviewModal] = useState(false);
  const [filterLoadingDelay, setFilterLoadingDelay] = useState(false);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  
  // Multi-level filter state
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);

  const barcodeRef = useRef<HTMLInputElement>(null);
  // scanner buffer refs (capture fast keyboard input from USB barcode scanners)
  const scannerBufferRef = useRef<string>("");
  const scannerLastTimeRef = useRef<number | null>(null);
  const scannerTimerRef = useRef<number | null>(null);
  const scanningRef = useRef(false); // Prevent double scan

  const auth = useContext(AuthContext);

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

  /* Always keep focus for USB scanner */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // If clicking interactive controls, don't steal focus
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
      // also if click inside a dropdown or modal control, avoid stealing
      if (target.closest && (target.closest('.dropdown') || target.closest('.modal'))) return;
      barcodeRef.current?.focus();
    };
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
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
  const batchRes = await getBatches(pid, 1);
  const batch = batchRes.data?.[0]; // server returns suitable batches first
  
  // Check if batch data exists before proceeding
  if (!batch || !batch.batchNo) {
    alert(t('billing.noBatchInfo'));
    return;
  }

      setCart(prev => {
        const batchNo = batch.batchNo ?? batch.batchId ?? String(batch.batchId ?? batch.id ?? "");
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

        const availableQty = batch.availableQty ?? batch.qty ?? 0;
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
            expiryDate: batch.expiryDate ?? "",
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
      }

      // Determine amount to charge with wallet deduction
      let amountToCharge = subtotalBeforeDiscount;
      let walletDeduction = 0;
      
      // If using wallet, deduct wallet balance
      if (useWallet && customer) {
        const walletBalance = customer.walletBalance || 0;
        walletDeduction = Math.min(walletBalance, amountToCharge);
        amountToCharge = Math.max(0, amountToCharge - walletDeduction);
      }

      const paymentPayload = {
        paymentMode,
        amountPaid: paymentMode === 'CASH' ? (cashReceived ?? amountToCharge) : amountToCharge,
        customerMobile: customerMobile || null,
        customerId: customerId || null,
        discount: discountAmt,
        walletUsed: walletDeduction,
        gst: gstAmt,
        grandTotal: subtotalBeforeDiscount
      };

      // Finalize bill with payment details
      const finalizeRes = await finalizeBill(billId, paymentPayload);
      const serverData = finalizeRes?.data ?? null;

      // Deduct from customer wallet if wallet was used
      if (walletDeduction > 0 && customerId) {
        try {
          await deductFromWallet(customerId, walletDeduction, `Payment for Bill ${billId}`);
          console.log(`Wallet deducted: ₹${walletDeduction} for customer ${customerId}`);
        } catch (error) {
          console.error('Error deducting from wallet:', error);
        }
      }

  setReceiptData({
        billId,
        items: cart.map(i => ({ ...i })),
        payment: paymentPayload,
        totals: computeTotals(),
        server: serverData,
        walletUsed: walletDeduction,
        amountToCharge: amountToCharge
      });
      setShowReceiptModal(true);
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
  const handleViewBillDetails = async (billId: string, billDate: string) => {
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
      
      console.log('✅ Bill details loaded:', { billId, items, discount: billData?.discount, total: billData?.totalAmount });
    } catch (err: any) {
      console.error('Failed to load bill details', err);
      alert('Failed to load bill details: ' + (err?.response?.data?.message || err?.message || String(err)));
      setBillItems([]);
      setBillDiscount(0);
      setBillSubTotal(0);
      setBillTaxAmount(0);
      setBillTotalAmount(0);
    } finally {
      setLoadingBillDetails(false);
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
        const res = await getBatches(productId, newQty);
        const candidate = res.data[0];
        const avail = (candidate?.availableQty ?? candidate?.qty) ?? 0;
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

  /* =====================
     Batch Allocation Modal Handler (DEPRECATED - Modal removed)
  ===================== */
  const openBatchAllocModal = (_cartItem: CartItem) => {
    // Function kept for backward compatibility but batch allocation modal has been removed
    alert('Batch allocation feature has been consolidated into the unified controls modal');
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
                const itemTotal = priceAfterDiscount * i.qty;
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
                    <td>₹{itemTotal.toFixed(2)}</td>
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
                          setCustomer(response.data);
                        }
                      } catch (err) {
                        setCustomer(null);
                      }
                    } else if (mobile.length === 0) {
                      setCustomer(null);
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
                const walletToUse = Math.min(walletBalance, subtotalBeforeDiscount);
                const amountAfterWallet = Math.max(0, subtotalBeforeDiscount - walletToUse);
                
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

                    {/* Wallet Option */}
                    {customer && walletBalance > 0 && (
                      <div className="bg-success bg-opacity-10 p-3 rounded mb-3 border border-success">
                        <div className="small fw-bold text-success mb-2">{t('billing.walletAvailable', { amount: walletBalance.toFixed(2) })}</div>
                        <Form.Check 
                          type="checkbox"
                          id="useWalletUnified"
                          label={t('billing.useWalletLabel', { walletAmount: walletToUse.toFixed(2), payAmount: amountAfterWallet.toFixed(2) })}
                          onChange={(e) => setUseWallet(e.target.checked)}
                          className="fw-bold small"
                        />
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
                          setSelectedCategory(e.target.value);
                          setSelectedBrand("");
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
                          setSelectedBrand(e.target.value);
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
                              <Badge bg="primary" style={{ whiteSpace: 'nowrap', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                                {product.totalQty}
                              </Badge>
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

          {/* TAB 3: REFUND */}
          {unifiedModalTab === "refund" && (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <h6 className="fw-bold mb-3">{t('billing.refundTitle')}</h6>
              
              {loadingReserved ? (
                <div className="text-center p-5">
                  <div className="spinner-border text-warning mb-3" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="text-muted">{t('billing.loadingReservedItems')}</p>
                </div>
              ) : reservedItems.length === 0 ? (
                <div className="alert alert-warning border-warning">
                  <h6 className="mb-3">{t('billing.noReservedItems')}</h6>
                  <p className="mb-2">{t('billing.noReservedItemsDesc')}</p>
                </div>
              ) : (
                <div>
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

      {/* Receipt Modal */}
      <Modal show={showReceiptModal} onHide={() => setShowReceiptModal(false)} size="lg">
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
                    const itemTotal = priceAfterDiscount * it.qty;
                    return (
                      <tr key={`${it.productId}-${it.batchNo}`}>
                        <td>{it.sku || it.name}</td>
                        <td>{it.qty}</td>
                        <td>₹{it.price.toFixed(2)}</td>
                        <td>₹{totalDiscount.toFixed(2)}</td>
                        <td>₹{itemTotal.toFixed(2)}</td>
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
          <Button variant="secondary" onClick={() => setShowReceiptModal(false)}>Close</Button>
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
            // done: close receipt and start a new bill (server already finalized)
            setShowReceiptModal(false);
            setReceiptData(null);
            setCart([]);
            setDiscount(0);
            setDiscountIsPercent(false);
            setCashReceived(undefined);
            setCustomerMobile('');
            setReservedForBill(false);
            const uname = auth?.user?.username ?? (() => { const s = localStorage.getItem('user'); if (!s) return 'guest'; try { return JSON.parse(s).username; } catch { return 'guest'; }})();
            const res = await startBill(uname);
            setBillId(res.data.billId);
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
                      {billItems.map((item: any, idx: number) => (
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
                              {item.discountAmount ? '-₹' + (item.discountAmount).toFixed(2) : '-'}
                            </small>
                          </td>
                          <td className="text-end">
                            <small className="fw-bold">
                              ₹{((item.price || 0) * (item.qty || item.quantity || 0) - (item.discountAmount || 0)).toFixed(2)}
                            </small>
                          </td>
                        </tr>
                      ))}
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
          <Button variant="secondary" onClick={() => setShowBillDetailsModal(false)}>
            Close
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
          <Button 
            variant="primary" 
            onClick={() => {
              loadInventoryForModal();
            }}
          >
            🔄 Refresh
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
    </div>
  );
};

export default Billing;
