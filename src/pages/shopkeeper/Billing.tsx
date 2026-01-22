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
  Badge
} from "react-bootstrap";
import {
  startBill,
  getProductBySku,
  getBatches,
  addItem,
  finalizeBill,
  type CartItem
} from "../../services/billingApi";

import {
  BrowserMultiFormatReader
} from "@zxing/browser";

import { AuthContext } from "../../auth/AuthContext";

const Billing = () => {
  const [billId, setBillId] = useState<string>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);

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

      // If user is focused on an input (manual typing), don't intercept — let the input handler run.
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) {
        // allow normal Enter when focused in barcode input
        return;
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
    const focus = () => barcodeRef.current?.focus();
    window.addEventListener("click", focus);
    return () => window.removeEventListener("click", focus);
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
      const batchRes = await getBatches(pid);
      const batch = batchRes.data[0]; // FIFO

      setCart(prev => {
        const batchNo = batch.batchNo ?? batch.batchId ?? String(batch.batchId ?? batch.id ?? "");
        const idx = prev.findIndex(i => i.productId === pid && i.batchNo === batchNo);

        if (idx !== -1) {
          if (prev[idx].qty + 1 > prev[idx].availableQty) return prev;
          const copy = [...prev];
          copy[idx].qty += 1;
          return copy;
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
            availableQty: batch.availableQty ?? batch.qty ?? 0
          }
        ];
      });

      // Play beep for feedback
      const audio = new Audio("/beep.mp3"); // Add beep.mp3 in public folder
      audio.play();

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

    for (const item of cart) {
      await addItem(billId, {
        productId: item.productId,
        batchNo: item.batchNo,
        quantity: item.qty
      });
    }

    await finalizeBill(billId);
    alert("✅ Bill Completed");
    window.location.reload();
  };

  /* =====================
     Cart quantity helpers
  ===================== */
  /* =====================
    Cart item quantity controls
  ===================== */
  const increaseQty = (productId: string, batchNo: string) => {
    setCart(prev => {
      return prev.map(i => {
        if (i.productId === productId && i.batchNo === batchNo) {
          if (i.qty + 1 > i.availableQty) return i; // limit
          return { ...i, qty: i.qty + 1 };
        }
        return i;
      });
    });
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
                onClick={pay}
                className="flex-grow-1"
                disabled={!billId || cart.length === 0}
              >
                PAY
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

          <div className="text-end mt-3">
            <h4>
              Total: <Badge bg="dark">₹{total}</Badge>
            </h4>
          </div>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Billing;
