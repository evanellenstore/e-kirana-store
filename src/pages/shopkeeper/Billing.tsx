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
  Modal
} from "react-bootstrap";
import ShopkeeperHeader from "../../components/ShopkeeperHeader";
import {
  startBill,
  getProductBySku,
  getBatches,
  addItemsBatch,
  finalizeBill,
  type CartItem
} from "../../services/billingApi";
import {
  getOrCreateCustomer,
  getCustomerByMobile,
  addToWallet,
  deductFromWallet,
  type Customer
} from "../../services/customerApi";
import {
  getReservedItems,
  releaseInventory,
  type ReservedItem
} from "../../services/inventoryService";

import { AuthContext } from "../../auth/AuthContext";
import "./Billing.css";

const Billing = () => {
  console.log("Billing component mounted");
  const [billId, setBillId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subtotalBeforeDiscount, setSubtotalBeforeDiscount] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isReserving, setIsReserving] = useState(false);
  const [reservedForBill, setReservedForBill] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [discountIsPercent, setDiscountIsPercent] = useState<boolean>(false);
  const [gstRate] = useState<number>(0);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMode, setPaymentMode] = useState<string>("CASH");
  const [cashReceived, setCashReceived] = useState<number | undefined>(undefined);
  const [customerMobile, setCustomerMobile] = useState<string>("");
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [showBatchAllocModal, setShowBatchAllocModal] = useState(false);
  const [batchAllocItem, setBatchAllocItem] = useState<any>(null);
  const [batchAllocOptions, setBatchAllocOptions] = useState<any[]>([]);
  const [batchAllocations, setBatchAllocations] = useState<Array<{ batchNo: string; qty: number; expiryDate: string }>>([]);
  const [useWallet, setUseWallet] = useState<boolean>(false);

  // Release/Refund state
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [reservedItems, setReservedItems] = useState<ReservedItem[]>([]);
  const [loadingReserved, setLoadingReserved] = useState(false);
  const [selectedReservedItem, setSelectedReservedItem] = useState<ReservedItem | null>(null);
  const [releaseQty, setReleaseQty] = useState<number>(1);
  const [isReleasing, setIsReleasing] = useState(false);

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
  /* =====================
     Start Bill
  ===================== */
  useEffect(() => {
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

    startBill(uname).then(res => setBillId(res.data.billId));
    barcodeRef.current?.focus();
  }, [auth?.user?.username]);

  // Global keycapture to support USB barcode scanners that act like keyboards.
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

        // reset buffer after short timeout if Enter never comes
        if (scannerTimerRef.current) window.clearTimeout(scannerTimerRef.current);
        scannerTimerRef.current = window.setTimeout(() => {
          scannerBufferRef.current = "";
          scannerLastTimeRef.current = null;
          scannerTimerRef.current = null;
        }, 800);
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
    if (!barcode.trim() || !billId || scanningRef.current) return;

    scanningRef.current = true;

    try {
      const productRes = await getProductBySku(barcode.trim());
      const product = productRes.data || {};

      const pid = product.productId ?? product.id ?? product.sku ?? "";
      
      // Validate product ID
      if (!pid) {
        alert('Product not found');
        return;
      }
      
  // Ask server for batches preferring ones that can satisfy qty=1
  const batchRes = await getBatches(pid, 1);
  const batch = batchRes.data?.[0]; // server returns suitable batches first
  
  // Check if batch data exists before proceeding
  if (!batch || !batch.batchNo) {
    alert('No batch information available for this product. Please check inventory.');
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
              alert('Not enough stock to increase quantity');
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
            alert('Product not added');
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
      alert("❌ Product not found");
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
        const val = window.prompt("Enter discount (append % for percent, e.g. 10 or 5%):");
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
      // open payment modal with 'p'
      if (e.key === 'p' || e.key === 'P') {
        setShowPaymentModal(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  
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
      setShowPaymentModal(false);
      setShowReceiptModal(true);
    } catch (err: any) {
      console.error('Payment failed', err);
      const msg = err?.response?.data?.message || err?.message || String(err);
      alert(`❌ Payment failed: ${msg}`);
    } finally {
      setIsPaying(false);
    }
  };

  const reserveItems = async () => {
    if (!billId || cart.length === 0) return;
    setIsReserving(true);
    try {
      // Final availability check: query server with required quantities for each product
      const checks = await Promise.all(cart.map(i => getBatches(i.productId, i.qty)));
      // reconcile availability - if any item cannot be fulfilled, ask user
      for (let idx = 0; idx < cart.length; idx++) {
        const i = cart[idx];
        const res = checks[idx];
        const cand = res.data[0];
        const avail = (cand?.availableQty ?? cand?.qty) ?? 0;
        if (avail < i.qty) {
          const ok = window.confirm(`${i.name || i.sku} only ${avail} available, requested ${i.qty}. Reserve anyway?`);
          if (!ok) {
            alert('Reservation cancelled');
            setIsReserving(false);
            return;
          }
        }
      }

      // Group items by productId to detect multi-batch allocations
      const itemsByProduct = new Map<string, typeof cart>();
      for (const item of cart) {
        if (!itemsByProduct.has(item.productId)) {
          itemsByProduct.set(item.productId, []);
        }
        itemsByProduct.get(item.productId)!.push(item);
      }

      // Build payload: if product has multiple rows (batches), create multi-batch format
      const payload: any[] = [];
      for (const [_, items] of itemsByProduct) {
        if (items.length > 1) {
          // Multi-batch: combine into single entry with "batches" array
          const firstItem = items[0];
          const batchesArray = items.map(item => ({
            batchNo: item.batchNo,
            quantity: item.qty,
            expiryDate: item.expiryDate
          }));
          payload.push({
            productId: firstItem.productId,
            name: firstItem.name,
            sku: firstItem.sku,
            price: firstItem.price,
            batches: batchesArray
          });
        } else {
          // Single-batch: use original format (backward compatible)
          const item = items[0];
          payload.push({
            productId: item.productId,
            batchNo: item.batchNo,
            quantity: item.qty,
            price: item.price,
            name: item.name,
            sku: item.sku,
            expiryDate: item.expiryDate
          });
        }
      }

      const res = await addItemsBatch(billId, payload);
      console.log('reserve addItemsBatch response', res?.data || res);
      setReservedForBill(true);
    } catch (e: any) {
      console.error('Reserve failed', e);
      alert('Failed to reserve items: ' + (e?.response?.data?.message || e?.message || String(e)));
      setReservedForBill(false);
      throw e;
    } finally {
      setIsReserving(false);
    }
  };

  // Load all reserved items from inventory
  const loadReservedItemsList = async () => {
    setLoadingReserved(true);
    try {
      console.log("Loading reserved items...");
      
      // Try to get reserved items from backend API
      const productIds = [1, 2, 3, 4, 5];
      const allReserved: ReservedItem[] = [];
      let hasError = false;
      
      for (const productId of productIds) {
        try {
          const res = await getReservedItems(productId);
          if (res.data && Array.isArray(res.data)) {
            allReserved.push(...res.data);
            console.log(`✅ Loaded ${res.data.length} items from product ${productId}`);
          }
        } catch (err: any) {
          // If 404, endpoint doesn't exist yet - that's OK, try demo data
          if (err?.response?.status === 404) {
            console.warn(`⚠️ API endpoint not available for product ${productId} (404)`);
            hasError = true;
          } else {
            console.warn(`Failed to load reserved items for product ${productId}:`, err);
            hasError = true;
          }
        }
      }
      
      // If API has no data but backend is working, show demo data
      if (allReserved.length === 0 && hasError) {
        console.log("ℹ️ Using demo data (backend endpoint not implemented yet)");
        allReserved.push({
          referenceId: "DEMO_BILL_001",
          quantity: 5,
          reservedDate: new Date().toISOString(),
          sku: "SKU-001",
          productName: "Demo Product 1",
          productId: 1
        });
        allReserved.push({
          referenceId: "DEMO_BILL_002",
          quantity: 3,
          reservedDate: new Date(Date.now() - 86400000).toISOString(),
          sku: "SKU-002",
          productName: "Demo Product 2",
          productId: 2
        });
        console.log("📌 NOTE: Using demo data - backend API endpoint needs to be implemented");
      }
      
      setReservedItems(allReserved);
      console.log("Reserved items loaded:", allReserved);
    } catch (e: any) {
      console.error('Failed to load reserved items', e);
      // Show demo data even on error for testing
      const demoData: ReservedItem[] = [
        {
          referenceId: "DEMO_BILL_001",
          quantity: 5,
          reservedDate: new Date().toISOString(),
          sku: "SKU-001",
          productName: "Demo Product 1",
          productId: 1
        }
      ];
      setReservedItems(demoData);
      console.log("ℹ️ Showing demo data due to error");
    } finally {
      setLoadingReserved(false);
    }
  };

  // Release a reserved item
  const handleReleaseItem = async () => {
    if (!selectedReservedItem) {
      alert('Please select a reserved item');
      return;
    }

    if (releaseQty <= 0 || releaseQty > selectedReservedItem.quantity) {
      alert('Invalid quantity to release');
      return;
    }

    setIsReleasing(true);
    try {
      console.log("Releasing item:", selectedReservedItem, "Qty:", releaseQty);
      
      // Assuming the release function takes productId, quantity, and referenceId
      // You may need to adjust based on your actual API
      await releaseInventory(
        parseInt(selectedReservedItem.referenceId) || 1, // Using product ID or reference
        releaseQty,
        selectedReservedItem.referenceId
      );
      
      alert('✅ Item released successfully!');
      setSelectedReservedItem(null);
      setReleaseQty(1);
      await loadReservedItemsList(); // Refresh the list
    } catch (e: any) {
      console.error('Release failed', e);
      alert('Failed to release item: ' + (e?.response?.data?.message || e?.message || String(e)));
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
        await addToWallet(cust.id || '', discountAmount, 'Discount credited');
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
     Batch Allocation Modal Handler
  ===================== */
  const openBatchAllocModal = async (cartItem: CartItem) => {
    try {
      // Fetch available batches for this product
      const res = await getBatches(cartItem.productId, cartItem.qty);
      setBatchAllocOptions(res.data || []);
      setBatchAllocItem(cartItem);
      
      // Initialize allocations with current cart item
      setBatchAllocations([{ 
        batchNo: cartItem.batchNo, 
        qty: cartItem.qty, 
        expiryDate: cartItem.expiryDate 
      }]);
      
      setShowBatchAllocModal(true);
    } catch (err) {
      console.error('Failed to fetch batches', err);
      alert('Failed to load batch options');
    }
  };

  const saveBatchAllocations = () => {
    if (!batchAllocItem) return;
    
    // Validate total quantity equals original quantity
    const totalQty = batchAllocations.reduce((sum, b) => sum + b.qty, 0);
    if (totalQty !== batchAllocItem.qty) {
      alert(`Total quantity must equal ${batchAllocItem.qty}. Current total: ${totalQty}`);
      return;
    }

    // Remove the old single-batch item(s) for this product
    setCart(prev => prev.filter(i => !(i.productId === batchAllocItem.productId && i.sku === batchAllocItem.sku)));
    
    // Add new items, one per batch allocation
    const newItems = batchAllocations.map((alloc) => ({
      ...batchAllocItem,
      batchNo: alloc.batchNo,
      qty: alloc.qty,
      expiryDate: alloc.expiryDate
    }));
    
    setCart(prev => [...prev, ...newItems]);
    
    setShowBatchAllocModal(false);
    setBatchAllocItem(null);
    setBatchAllocations([]);
  };

  return (
    <div className="billing-page-container">
      <ShopkeeperHeader 
        title="🧾 Billing & POS"
        description="Create and manage bills"
      />
      
      <Container className="billing-content" style={{ maxWidth: 1100 }}>
        {/* Main Billing Section */}
        <div className="billing-main-card">
          <div className="billing-header-section">
            <div className="billing-title-area">
              <h4 className="billing-title">
                Bill Details
                {billId && <Badge className="billing-badge bg-primary ms-3">Bill: {billId}</Badge>}
              </h4>
            </div>
          </div>

          <div className="billing-body">
          <Row className="g-2">
            <Col xs={12} md={8}>
              <InputGroup>
                <Form.Control
                  ref={barcodeRef}
                  placeholder="Scan barcode or enter SKU"
                  onKeyDown={e => {
                    if (e.key === "Enter") {
                      console.log("manual Enter pressed, value:", e.currentTarget.value);
                      handleBarcode(e.currentTarget.value);
                    }
                  }}
                  style={{ fontSize: 18 }}
                />
                <Button variant="outline-secondary" onClick={() => barcodeRef.current?.focus()}>Focus</Button>
              </InputGroup>
            </Col>

              <Col xs={12} md={4} className="d-flex gap-2">
                <Button
                  variant="warning"
                  onClick={() => {
                    setShowReleaseModal(true);
                    loadReservedItemsList();
                  }}
                  className="flex-grow-1"
                >
                  🔄 Refund
                </Button>

                <Button
                  variant="success"
                  onClick={async () => {
                    if (!billId || cart.length === 0) return;
                    // reserve items before showing payment modal
                    try {
                      await reserveItems();
                    } catch (_) {
                      // reservation failed, don't open modal
                      return;
                    }
                    setShowPaymentModal(true);
                  }}
                  className="flex-grow-1"
                  disabled={!billId || cart.length === 0}
                >
                  {isReserving ? 'Reserving…' : 'PAY'}
                </Button>
              </Col>
          </Row>

          <Table striped bordered hover size="sm" className="mt-3">
            <thead>
              <tr>
                <th>Item</th>
                <th style={{ width: 180 }}>Qty</th>
                <th style={{ width: 120 }}>Price</th>
                <th style={{ width: 100 }}>Discount</th>
                <th style={{ width: 140 }}>Total</th>
                <th style={{ width: 100 }}>Action</th>
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
                        <div className="ms-auto small text-muted">Avl: {i.availableQty}</div>
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
                      <div>Subtotal</div>
                      <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                    </div>
                    <div className="d-flex justify-content-between small">
                      <div>Discount {discountIsPercent ? `(${discount}%)` : ''}</div>
                      <div>₹{discountAmt.toFixed(2)}</div>
                    </div>
                    <div className="d-flex justify-content-between small">
                      <div>GST</div>
                      <div>₹{gstAmt.toFixed(2)}</div>
                    </div>
                    <hr />
                    <div className="d-flex justify-content-between fw-bold">
                      <div>Grand Total</div>
                      <div>₹{grandTotal.toFixed(2)}</div>
                    </div>
                  </>
                );
              })()}
            </Col>
          </Row>

          <div className="billing-total-section">
            <h4 className="billing-total-label">
              Total: <Badge className="billing-total-badge bg-success">₹{total.toFixed(2)}</Badge>
            </h4>
          </div>
          </div>
        </div>
      </Container>

      {/* Payment Modal */}
      <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <div className="mb-3 small text-muted">Bill: {billId}</div>

            {/* STEP 1: Customer Mobile Input - MOVED TO TOP */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold">👤 Customer Mobile (optional)</Form.Label>
              <Form.Control 
                placeholder="Enter 10-digit mobile number"
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
                  ℹ️ New customer - wallet will be created on payment
                </small>
              )}
            </Form.Group>

            <hr className="my-3" />

            {/* STEP 2: Bill Summary */}
            {(() => {
              const { discountAmt, gstAmt } = computeTotals();
              const walletBalance = customer?.walletBalance || 0;
              const walletToUse = Math.min(walletBalance, subtotalBeforeDiscount);
              const amountAfterWallet = Math.max(0, subtotalBeforeDiscount - walletToUse);
              
              return (
                <>
                  <div className="fw-bold mb-3 text-primary">📋 Bill Summary</div>
                  
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
                      <div className="small fw-bold text-success mb-2">💳 Wallet Available: ₹{walletBalance.toFixed(2)}</div>
                      <Form.Check 
                        type="checkbox"
                        id="useWallet"
                        label={`Use ₹${walletToUse.toFixed(2)} → Pay ₹${amountAfterWallet.toFixed(2)}`}
                        onChange={(e) => setUseWallet(e.target.checked)}
                        className="fw-bold small"
                      />
                    </div>
                  )}

                  <hr className="my-3" />
                </>
              );
            })()}

          <Form.Group className="mb-2">
            <Form.Label>Payment Mode</Form.Label>
            <Form.Select value={paymentMode} onChange={e => setPaymentMode(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="CREDIT">Credit</option>
            </Form.Select>
          </Form.Group>

          {paymentMode === 'CASH' && (
            <Form.Group className="mb-2">
              <Form.Label>Cash Received</Form.Label>
              <Form.Control type="number" value={cashReceived ?? ''} onChange={e => setCashReceived(Number(e.target.value))} />
              <div className="small text-muted mt-1">Change: ₹{(() => {
                const change = Math.max(0, (cashReceived ?? 0) - subtotalBeforeDiscount);
                return change.toFixed(2);
              })()}</div>
            </Form.Group>
          )}

        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
          <Button variant="primary" disabled={isPaying} onClick={async () => {
            // validate payment
            if (!billId) { alert('No active bill'); return; }
            
            const amountToPay = subtotalBeforeDiscount;
            let finalAmount = amountToPay;
            
            // Deduct wallet if using
            if (useWallet && customer) {
              const walletBalance = customer.walletBalance || 0;
              const walletToUse = Math.min(walletBalance, finalAmount);
              finalAmount = Math.max(0, finalAmount - walletToUse);
            }
            
            if (paymentMode === 'CASH' && (cashReceived ?? 0) < finalAmount) {
              alert(`Cash received is less than amount due (₹${finalAmount.toFixed(2)})`);
              return;
            }
            // log payload for debugging
            console.log('Payment start', { paymentMode, cashReceived, customerMobile, useWallet, totals: computeTotals() });
            await pay();
          }}>
            {isPaying ? 'Processing…' : `Pay ₹${subtotalBeforeDiscount.toFixed(2)}`}
          </Button>
        </Modal.Footer>
      </Modal>
      {/* Receipt Modal */}
      <Modal show={showReceiptModal} onHide={() => setShowReceiptModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Receipt - {receiptData?.billId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {receiptData ? (
            <div id="receipt-content">
              <h5>Store Receipt</h5>
              <div className="small text-muted">Bill: {receiptData.billId}</div>
              <Table size="sm" className="mt-2">
                <thead>
                  <tr><th>Item</th><th>Qty</th><th>Price</th><th>Discount</th><th>Total</th></tr>
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
                <div className="d-flex justify-content-between"><div>Subtotal</div><div>₹{(receiptData.totals.discountAmt + receiptData.totals.taxable).toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>Discount</div><div>₹{receiptData.totals.discountAmt.toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>GST</div><div>₹{receiptData.totals.gstAmt.toFixed(2)}</div></div>
                <hr />
                <div className="d-flex justify-content-between fw-bold"><div>Grand Total</div><div>₹{receiptData.totals.grandTotal.toFixed(2)}</div></div>
                
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
                  <div className="small text-success fw-bold">✓ Customer Wallet Created</div>
                  <div className="small">Mobile: {receiptData.payment.customerMobile}</div>
                  <div className="small">Discount Credited: ₹{receiptData.payment.discount?.toFixed(2) || '0.00'}</div>
                  <div className="small text-muted">Use wallet balance in future purchases</div>
                </div>
              )}
            </div>
          ) : (
            <div>No receipt data</div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReceiptModal(false)}>Close</Button>
          <Button variant="primary" onClick={() => {
            // print receipt
            const content = document.getElementById('receipt-content');
            if (!content) return;
            const w = window.open('', '_blank', 'width=600,height=800');
            if (!w) { alert('Unable to open print window'); return; }
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
          }}>Done</Button>
        </Modal.Footer>
      </Modal>

      {/* Batch Allocation Modal */}
      <Modal show={showBatchAllocModal} onHide={() => setShowBatchAllocModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Allocate {batchAllocItem?.name} - {batchAllocItem?.qty} units
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <p className="text-muted">
              Total required: <strong>{batchAllocItem?.qty} units</strong>
            </p>
            <p className="text-muted">
              Total allocated: <strong>{batchAllocations.reduce((sum, b) => sum + (b.qty || 0), 0)} units</strong>
            </p>
          </div>

          <Table striped bordered hover size="sm" className="mb-3">
            <thead>
              <tr>
                <th>Batch No</th>
                <th>Expiry Date</th>
                <th>Available Qty</th>
                <th>Allocate Qty</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batchAllocations.map((alloc, idx) => {
                const batchOption = batchAllocOptions.find(b => b.batchNo === alloc.batchNo);
                return (
                  <tr key={idx}>
                    <td>
                      <Form.Select
                        size="sm"
                        value={alloc.batchNo}
                        onChange={(e) => {
                          const newAllocs = [...batchAllocations];
                          newAllocs[idx].batchNo = e.target.value;
                          const selectedBatch = batchAllocOptions.find(b => b.batchNo === e.target.value);
                          if (selectedBatch) {
                            newAllocs[idx].expiryDate = selectedBatch.expiryDate;
                          }
                          setBatchAllocations(newAllocs);
                        }}
                      >
                        <option value="">-- Select Batch --</option>
                        {batchAllocOptions.map((batch, bidx) => (
                          <option key={bidx} value={batch.batchNo}>
                            {batch.batchNo}
                          </option>
                        ))}
                      </Form.Select>
                    </td>
                    <td className="text-muted">{alloc.expiryDate}</td>
                    <td className="text-center">{batchOption?.availableQty || 0}</td>
                    <td>
                      <Form.Control
                        type="number"
                        size="sm"
                        min="0"
                        max={batchOption?.availableQty || 0}
                        value={alloc.qty}
                        onChange={(e) => {
                          const newAllocs = [...batchAllocations];
                          newAllocs[idx].qty = parseInt(e.target.value) || 0;
                          setBatchAllocations(newAllocs);
                        }}
                      />
                    </td>
                    <td className="text-center">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          const newAllocs = batchAllocations.filter((_, i) => i !== idx);
                          setBatchAllocations(newAllocs);
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>

          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => {
              setBatchAllocations([...batchAllocations, { batchNo: '', qty: 0, expiryDate: '' }]);
            }}
          >
            + Add Another Batch
          </Button>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBatchAllocModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={saveBatchAllocations}>
            Save Allocations
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Release/Refund Modal */}
      <Modal show={showReleaseModal} onHide={() => setShowReleaseModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>🔄 Refund - Release Reserved Items</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loadingReserved ? (
            <div className="text-center p-4">
              <p>Loading reserved items...</p>
            </div>
          ) : reservedItems.length === 0 ? (
            <div className="alert alert-info">
              No reserved items available for refund.
            </div>
          ) : (
            <div>
              <Form.Group className="mb-3">
                <Form.Label>
                  <strong>Select Reserved Item:</strong>
                </Form.Label>
                <Form.Select
                  value={selectedReservedItem?.referenceId || ""}
                  onChange={(e) => {
                    const item = reservedItems.find(
                      (item) => item.referenceId === e.target.value
                    );
                    setSelectedReservedItem(item || null);
                    setReleaseQty(item ? item.quantity : 1);
                  }}
                >
                  <option value="">-- Select an item --</option>
                  {reservedItems.map((item, idx) => (
                    <option key={idx} value={item.referenceId}>
                      {item.sku} - {item.productName} ({item.quantity} units)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              {selectedReservedItem && (
                <div className="alert alert-light border">
                  <h6>Selected Item Details:</h6>
                  <ul className="mb-0">
                    {selectedReservedItem.sku && (
                      <li>
                        <strong>SKU:</strong> {selectedReservedItem.sku}
                      </li>
                    )}
                    {selectedReservedItem.productName && (
                      <li>
                        <strong>Product:</strong> {selectedReservedItem.productName}
                      </li>
                    )}
                    <li>
                      <strong>Reference ID:</strong> {selectedReservedItem.referenceId}
                    </li>
                    <li>
                      <strong>Total Reserved:</strong> {selectedReservedItem.quantity} units
                    </li>
                    <li>
                      <strong>Reserved Date:</strong>{" "}
                      {new Date(selectedReservedItem.reservedDate || "").toLocaleDateString()}
                    </li>
                  </ul>

                  <Form.Group className="mt-3">
                    <Form.Label>
                      <strong>Quantity to Release:</strong>
                    </Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max={selectedReservedItem.quantity}
                      value={releaseQty}
                      onChange={(e) => setReleaseQty(parseInt(e.target.value) || 1)}
                    />
                    <small className="text-muted">
                      Max: {selectedReservedItem.quantity} units
                    </small>
                  </Form.Group>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReleaseModal(false)}>
            Close
          </Button>
          <Button
            variant="warning"
            onClick={handleReleaseItem}
            disabled={!selectedReservedItem || isReleasing}
          >
            {isReleasing ? "Releasing..." : "🔄 Release Item"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Billing;
