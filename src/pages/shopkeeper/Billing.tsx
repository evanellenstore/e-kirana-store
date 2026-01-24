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
import {
  startBill,
  getProductBySku,
  getBatches,
  addItemsBatch,
  finalizeBill,
  type CartItem
} from "../../services/billingApi";

import {
  BrowserMultiFormatReader
} from "@zxing/browser";

import { AuthContext } from "../../auth/AuthContext";

const Billing = () => {
  console.log("Billing component mounted");
  const [billId, setBillId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
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
  // Ask server for batches preferring ones that can satisfy qty=1
  const batchRes = await getBatches(pid, 1);
  const batch = batchRes.data[0]; // server returns suitable batches first

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
    setTotal(cart.reduce((s, i) => s + i.price * i.qty, 0));
  }, [cart]);

  // Helper: compute discount, gst and grand total
  const computeTotals = () => {
    const discountAmt = discountIsPercent ? (total * discount) / 100 : discount;
    const taxable = Math.max(0, total - discountAmt);
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
      const discountAmt = discountIsPercent ? (total * discount) / 100 : discount;
      const taxable = Math.max(0, total - discountAmt);
      const gstAmt = taxable * gstRate;
      const grandTotal = taxable + gstAmt;

      const paymentPayload = {
        paymentMode,
        amountPaid: paymentMode === 'CASH' ? (cashReceived ?? grandTotal) : grandTotal,
        customerMobile: customerMobile || null,
        discount: discountAmt,
        gst: gstAmt,
        grandTotal
      };

      await finalizeBill(billId, paymentPayload);
      // show receipt modal with server response (if any) and cart snapshot
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

  return (
    <Container className="py-4" style={{ maxWidth: 900 }}>
      <Card>
        <Card.Header>
          <Row className="align-items-center">
            <Col><h4 className="mb-0">🧾 Billing</h4></Col>
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
                <th style={{ width: 140 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {cart.map(i => (
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
                  <td>₹{i.price}</td>
                  <td>₹{i.price * i.qty}</td>
                </tr>
              ))}
            </tbody>
          </Table>

          {/* Summary */}
          <Row className="mt-2">
            <Col md={{ span: 4, offset: 8 }}>
              <div className="d-flex justify-content-between small">
                <div>Subtotal</div>
                <div>₹{total.toFixed(2)}</div>
              </div>
              <div className="d-flex justify-content-between small">
                <div>Discount {discountIsPercent ? `(${discount}%)` : ''}</div>
                <div>
                  ₹{(discountIsPercent ? (total * discount) / 100 : discount).toFixed(2)}
                </div>
              </div>
              <div className="d-flex justify-content-between small">
                <div>GST</div>
                <div>
                  ₹{( (total - (discountIsPercent ? (total*discount)/100 : discount)) * gstRate ).toFixed(2)}
                </div>
              </div>
              <hr />
              <div className="d-flex justify-content-between fw-bold">
                <div>Grand Total</div>
                <div>
                  ₹{( (total - (discountIsPercent ? (total*discount)/100 : discount)) * (1 + gstRate) ).toFixed(2)}
                </div>
              </div>
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
              const { discountAmt, gstAmt, grandTotal } = computeTotals();
              return (
                <>
                  <div className="d-flex justify-content-between">
                    <div>Subtotal</div>
                    <div>₹{total.toFixed(2)}</div>
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
                    <div>₹{grandTotal.toFixed(2)}</div>
                  </div>
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
                const { grandTotal } = computeTotals();
                const change = Math.max(0, (cashReceived ?? 0) - grandTotal);
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
            const { grandTotal } = computeTotals();
            if (!billId) { alert('No active bill'); return; }
            if (paymentMode === 'CASH' && (cashReceived ?? 0) < grandTotal) {
              alert('Cash received is less than grand total');
              return;
            }
            // log payload for debugging
            console.log('Payment start', { paymentMode, cashReceived, customerMobile, totals: computeTotals() });
            await pay();
          }}>
            {isPaying ? 'Processing…' : `Pay ₹${computeTotals().grandTotal.toFixed(2)}`}
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
                  <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
                </thead>
                <tbody>
                  {receiptData.items.map((it: any) => (
                    <tr key={`${it.productId}-${it.batchNo}`}>
                      <td>{it.sku || it.name}</td>
                      <td>{it.qty}</td>
                      <td>₹{it.price}</td>
                      <td>₹{(it.price * it.qty).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              <div className="mt-3">
                <div className="d-flex justify-content-between"><div>Subtotal</div><div>₹{total.toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>Discount</div><div>₹{computeTotals().discountAmt.toFixed(2)}</div></div>
                <div className="d-flex justify-content-between"><div>GST</div><div>₹{computeTotals().gstAmt.toFixed(2)}</div></div>
                <hr />
                <div className="d-flex justify-content-between fw-bold"><div>Grand Total</div><div>₹{computeTotals().grandTotal.toFixed(2)}</div></div>
              </div>
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
    </Container>
  );
};

export default Billing;
