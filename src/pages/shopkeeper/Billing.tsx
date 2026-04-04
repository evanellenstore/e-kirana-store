import { useContext, useEffect, useRef, useState } from "react";
import {
  Container,
  Card,
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
  addToWallet,
  type Customer
} from "../../services/customerApi";

import {
  BrowserMultiFormatReader
} from "@zxing/browser";

import { AuthContext } from "../../auth/AuthContext";

const Billing = () => {
  console.log("Billing component mounted");
  const [billId, setBillId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [subtotalBeforeDiscount, setSubtotalBeforeDiscount] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
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

  const barcodeRef = useRef<HTMLInputElement>(null);
  // scanner buffer refs (capture fast keyboard input from USB barcode scanners)
  const scannerBufferRef = useRef<string>("");
  const scannerLastTimeRef = useRef<number | null>(null);
  const scannerTimerRef = useRef<number | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
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
      // Auto-stop camera if USB scanner used
      if (cameraOn) stopCameraScan();

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
     Start Camera Scan (Mobile)
  ===================== */
  const startCameraScan = async () => {
    setCameraOn(true);

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    try {
      const devices =
        await BrowserMultiFormatReader.listVideoInputDevices();

      // Force BACK camera
      const backCamera =
        devices.find(d =>
          d.label.toLowerCase().includes("back") ||
          d.label.toLowerCase().includes("rear")
        ) || devices[devices.length - 1];

      if (!backCamera) {
        alert("No camera found");
        stopCameraScan();
        return;
      }

      // Wait for the video element to be rendered and mounted
      let videoElem: HTMLVideoElement | null = null;
      for (let i = 0; i < 6; i++) {
        videoElem = document.getElementById("video") as HTMLVideoElement | null;
        if (videoElem) break;
        // wait a bit for React to render the element
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 100));
      }

      if (!videoElem) {
        console.warn("Video element not found after mount; aborting camera start");
        alert("Camera failed to start");
        stopCameraScan();
        return;
      }

      console.log("Starting decode on device", backCamera.deviceId, "videoElem:", videoElem);

      await reader.decodeFromVideoDevice(
        backCamera.deviceId,
        videoElem,
        (result) => {
          if (result) {
            console.log("ZXing result:", result.getText());
            handleBarcode(result.getText());
            // keep camera briefly to show feedback; then stop
            setTimeout(stopCameraScan, 300);
          }
        }
      );
    } catch (e) {
      console.error("Camera start failed", e);
      alert("Camera permission denied");
      stopCameraScan();
    }
  };

  /* =====================
     Stop Camera
  ===================== */
  const stopCameraScan = () => {
    // stop ZXing reader
    try {
      if (readerRef.current) {
        (readerRef.current as any).reset?.();
        // some versions expose stopContinuousDecode
        (readerRef.current as any).stopContinuousDecode?.();
      }
    } catch (e) {
      console.warn("Error resetting reader", e);
    }

    // stop any active media tracks on the video element
    try {
      const video = document.getElementById("video") as HTMLVideoElement | null;
      if (video) {
        const stream = (video.srcObject as MediaStream) || null;
        if (stream && stream.getTracks) {
          stream.getTracks().forEach(t => {
            try { t.stop(); } catch (_) { /* ignore */ }
          });
        }
        try {
          video.pause();
        } catch (_) {}
        try {
          video.srcObject = null;
        } catch (_) {
          video.removeAttribute('src');
        }
      }
    } catch (e) {
      console.warn("Error stopping video stream", e);
    }

    readerRef.current = null;
    setCameraOn(false);
  };


  
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

      // Pay full amount (subtotalBeforeDiscount) since discount goes to wallet
      const fullAmount = subtotalBeforeDiscount;

      const paymentPayload = {
        paymentMode,
        amountPaid: paymentMode === 'CASH' ? (cashReceived ?? fullAmount) : fullAmount,
        customerMobile: customerMobile || null,
        customerId: customerId || null,
        discount: discountAmt,
        gst: gstAmt,
        grandTotal: fullAmount
      };

      // Finalize bill with payment details
      const finalizeRes = await finalizeBill(billId, paymentPayload);
      const serverData = finalizeRes?.data ?? null;
      setReceiptData({
        billId,
        items: cart.map(i => ({ ...i })),
        payment: paymentPayload,
        totals: computeTotals(),
        server: serverData
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
    <Container className="py-4" style={{ maxWidth: 900 }}>
      <ShopkeeperHeader 
        title="🧾 Billing & POS"
        description="Create and manage bills"
      />
      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col><h5 className="mb-0">Bill Details</h5></Col>
            <Col className="text-end">{billId ? <Badge bg="secondary">Bill: {billId}</Badge> : null}</Col>
          </Row>
        </Card.Header>

        <Card.Body>
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
                  variant={cameraOn ? "danger" : "primary"}
                  onClick={cameraOn ? stopCameraScan : startCameraScan}
                  className="flex-grow-1"
                >
                  {cameraOn ? "❌ Stop Camera" : "📷 Scan Using Camera"}
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

          {cameraOn && (
            <div className="mt-3">
              <video
                id="video"
                autoPlay
                muted
                playsInline
                style={{ width: "100%", borderRadius: 6, border: "1px solid #ddd" }}
              />
            </div>
          )}

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

          <div className="text-end mt-3">
            <h4>
              Total: <Badge bg="dark">₹{total}</Badge>
            </h4>
          </div>
        </Card.Body>
      </Card>
      {/* Payment Modal */}
      <Modal show={showPaymentModal} onHide={() => setShowPaymentModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Payment</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            <div className="mb-2 small text-muted">Bill: {billId}</div>

            {(() => {
              const { discountAmt, gstAmt } = computeTotals();
              return (
                <>
                  <div className="d-flex justify-content-between">
                    <div>Subtotal</div>
                    <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                  </div>

                  <div className="d-flex justify-content-between">
                    <div>Discount {discountIsPercent ? `(${discount}%)` : ''}</div>
                    <div>₹{discountAmt.toFixed(2)}</div>
                  </div>

                  <div className="d-flex justify-content-between">
                    <div>GST</div>
                    <div>₹{gstAmt.toFixed(2)}</div>
                  </div>

                  <hr />

                  <div className="d-flex justify-content-between fw-bold mb-3">
                    <div>Grand Total</div>
                    <div>₹{subtotalBeforeDiscount.toFixed(2)}</div>
                  </div>
                </>
              );
            })()}

          {customer && (
            <div className="bg-light p-2 rounded mb-3">
              <div className="small fw-bold">💳 Customer Wallet</div>
              <div className="d-flex justify-content-between">
                <div className="small">Mobile: {customer.mobileNo || 'N/A'}</div>
                <div className="small fw-semibold text-success">Balance: ₹{(customer.walletBalance || 0).toFixed(2)}</div>
              </div>
            </div>
          )}

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

          <Form.Group className="mb-2">
            <Form.Label>Customer Mobile (optional)</Form.Label>
            <Form.Control value={customerMobile} onChange={e => setCustomerMobile(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
          <Button variant="primary" disabled={isPaying} onClick={async () => {
            // validate cash
            if (!billId) { alert('No active bill'); return; }
            if (paymentMode === 'CASH' && (cashReceived ?? 0) < subtotalBeforeDiscount) {
              alert('Cash received is less than grand total');
              return;
            }
            // log payload for debugging
            console.log('Payment start', { paymentMode, cashReceived, customerMobile, totals: computeTotals() });
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
    </Container>
  );
};

export default Billing;
