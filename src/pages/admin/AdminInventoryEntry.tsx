import React, { useEffect, useState } from "react";
import {
  Container,
  Form,
  Button,
  Card,
  Alert,
  Spinner
} from "react-bootstrap";

import {
  getActiveCategories,
  getNamesByBrand,
  getProductBySku,
  getBrandsByCategory,
  type Product
} from "../../services/productService";
import { adjustInventory } from "../../services/adminInventoryService";

const AdminInventoryEntry: React.FC = () => {

  /* ======================
     Dropdown data
  ====================== */
  const [categories, setCategories] = useState<unknown[]>([]);
  const [brands, setBrands] = useState<unknown[]>([]);
  const [names, setNames] = useState<unknown[]>([]);

  /* ======================
     Helper
  ====================== */
  const optionToString = (item: unknown) => {
    if (item == null) return "";
    if (typeof item === "string") return item;
    if (typeof item === "number") return String(item);
    if (typeof item === "object") {
      const obj = item as Record<string, any>;
      return (
        obj.category ??
        obj.brand ??
        obj.name ??
        obj.value ??
        obj.label ??
        obj.id ??
        JSON.stringify(obj)
      );
    }
    return String(item);
  };

  /* ======================
     Selected values
  ====================== */
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState<number | null>(null);
  const [sku, setSku] = useState("");
  const [supplierName, setSupplierName] = useState(""); // ✅ added

  /* ======================
     Product
  ====================== */
  const [product, setProduct] = useState<Product | null>(null);
  const [productError, setProductError] = useState<string | null>(null);

  /* ======================
     Inventory fields
  ====================== */
  const [quantity, setQuantity] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [expiryDate, setExpiryDate] = useState<string | null>(null);

  const presetQuantities = [1, 2, 5, 10, 25, 50, 100];

  /* ======================
     UI state
  ====================== */
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  /* ======================
     LOAD CATEGORIES
  ====================== */
  useEffect(() => {
    setLoading(true);
    getActiveCategories()
      .then((res: any) => setCategories(res.data))
      .finally(() => setLoading(false));
  }, []);

  /* ======================
     LOAD BRANDS BY CATEGORY
  ====================== */
  useEffect(() => {
    if (!category) {
      setBrands([]);
      setBrand(null);
      return;
    }

    setLoading(true);
    // Find category ID from category value
    const categoryObj = categories.find((c: any) => optionToString(c) === category);
    if (categoryObj && categoryObj.id) {
      getBrandsByCategory(categoryObj.id)
        .then(res => {
          console.log("Brands for category:", res.data);
          setBrands(res.data || []);
        })
        .catch(err => {
          console.error("Failed to load brands:", err);
          setBrands([]);
        })
        .finally(() => setLoading(false));
    } else {
      setBrands([]);
      setLoading(false);
    }
  }, [category, categories]);

  /* ======================
     LOAD PRODUCT NAMES
  ====================== */
  useEffect(() => {
    if (!brand) return;

    setSku("");
    setProduct(null);

    setLoading(true);
    getNamesByBrand(brand)
      .then(res => setNames(res.data))
      .finally(() => setLoading(false));
  }, [brand]);

  /* ======================
     LOAD PRODUCT DETAILS
  ====================== */
  useEffect(() => {
    if (!sku) return;

    setLoading(true);
    setProductError(null);
    getProductBySku(sku)
      .then(res => {
        // axios response usually in res.data — but backends sometimes wrap inside { data: ... } or return arrays
        const body = (res as any).data ?? res;
        const payload = body.data ?? body;

        if (Array.isArray(payload)) {
          if (payload.length > 0) setProduct(payload[0]);
          else setProduct(null);
        } else if (payload && typeof payload === "object") {
          setProduct(payload as Product);
        } else {
          setProduct(null);
        }

        // debug log — remove later
        // eslint-disable-next-line no-console
        console.debug("getProductBySku response:", res);
      })
      .catch(err => {
        setProduct(null);
        setProductError(err?.message || "Failed to load product");
        // eslint-disable-next-line no-console
        console.error("getProductBySku error:", err);
      })
      .finally(() => setLoading(false));
  }, [sku]);

  /* ======================
     SUBMIT
  ====================== */
  const handleSubmit = () => {
    if (!product || product.id == null || !confirmed || quantity <= 0 || !expiryDate) return;

    adjustInventory(product.id, {
      quantity,
      type: "IN",
      remarks,
      supplierName,              // ✅ sent to backend
      expiryDate: expiryDate
    }).then(() => {
      setSuccess("✅ Inventory updated successfully");
      resetForm();
    });
  };

  /* ======================
     RESET FORM
  ====================== */
  const resetForm = () => {
    setCategory("");
    setBrand(null);
    setSku("");
    setSupplierName("");         // ✅ reset
    setProduct(null);
    setQuantity(0);
    setRemarks("");
    setConfirmed(false);
    setExpiryDate(null);
  };

  return (
    <Container className="mt-4" style={{ maxWidth: 520, width: "100%" }}>
      <Card className="shadow">
        <Card.Body>

          <Card.Title className="mb-3">📦 Inventory Entry</Card.Title>

          {loading && <Spinner animation="border" size="sm" />}
          {success && <Alert variant="success">{success}</Alert>}

          {/* CATEGORY */}
          <Form.Group className="mb-3">
            <Form.Label>Category</Form.Label>
            <Form.Select
              value={category}
              onChange={e => setCategory(e.target.value)}
            >
              <option value="">-- Select Category --</option>
              {categories.map((c, idx) => {
                const v = optionToString(c) || `cat-${idx}`;
                return <option key={v} value={v}>{v}</option>;
              })}
            </Form.Select>
          </Form.Group>

          {/* BRAND */}
          <Form.Group className="mb-3">
            <Form.Label>🏷️ Brand</Form.Label>
            {!category ? (
              <Form.Select disabled>
                <option value="">👆 Select Category First</option>
              </Form.Select>
            ) : loading ? (
              <div style={{ display: "flex", alignItems: "center", padding: "8px 12px" }}>
                <Spinner animation="border" size="sm" style={{ marginRight: "8px" }} />
                Loading brands...
              </div>
            ) : brands.length > 0 ? (
              <Form.Select
                value={brand ?? ""}
                onChange={e => setBrand(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">-- Select Brand --</option>
                {brands.map((b) => {
                  const brandObj = b as any;
                  return <option key={brandObj.id} value={brandObj.id}>{brandObj.brand}</option>;
                })}
              </Form.Select>
            ) : (
              <div style={{ padding: "8px 12px", color: "#dc3545", fontSize: "14px" }}>
                ⚠️ No brands mapped to this category
              </div>
            )}
          </Form.Group>

          {/* PRODUCT NAME */}
          <Form.Group className="mb-3">
            <Form.Label>Product Name</Form.Label>
            <Form.Select
              value={sku}
              disabled={!brand}
              onChange={e => setSku(e.target.value)}
            >
              <option value="">-- Select Product --</option>
              {names.map((n, idx) => {
                const v = optionToString(n) || `name-${idx}`;
                return <option key={v} value={v}>{v}</option>;
              })}
            </Form.Select>
          </Form.Group>

          {/* PRODUCT INFO */}
          {product && (
            <Alert variant="info">
              <strong>SKU:</strong> {product.sku}<br />
              <strong>Price:</strong> ₹{product.price}<br />
              <strong>Unit:</strong> {product.unit}
            </Alert>
          )}
          {productError && (
            <Alert variant="danger">Failed to load product: {productError}</Alert>
          )}

          {/* SUPPLIER */}
          <Form.Group className="mb-3">
            <Form.Label>Supplier Name</Form.Label>
            <Form.Control
              placeholder="Enter supplier name"
              value={supplierName}
              onChange={e => setSupplierName(e.target.value)}
            />
          </Form.Group>

          {/* CONFIRM */}
          <Form.Check
            type="checkbox"
            label="Confirm selected product"
            className="mb-3"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
          />

          {/* QUANTITY */}
          <Form.Group className="mb-3">
            <Form.Label>Quantity (IN)</Form.Label>
            <Form.Select
              value={String(quantity || "")}
              onChange={e => setQuantity(Number(e.target.value))}
            >
              <option value="">-- Select Quantity --</option>
              {presetQuantities.map(q => (
                <option key={q} value={q}>{q}</option>
              ))}
            </Form.Select>
          </Form.Group>

          {/* EXPIRY DATE */}
          <Form.Group className="mb-3">
            <Form.Label>Expiry Date *</Form.Label>
            <Form.Control
              type="date"
              value={expiryDate ?? ""}
              onChange={e => setExpiryDate(e.target.value || null)}
              isInvalid={!expiryDate && confirmed}
            />
            <Form.Control.Feedback type="invalid">
              Expiry Date is required
            </Form.Control.Feedback>
          </Form.Group>

          {/* REMARKS */}
          <Form.Group className="mb-3">
            <Form.Label>Remarks</Form.Label>
            <Form.Control
              placeholder="Initial stock"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />
          </Form.Group>

          <Button
            variant="primary"
            className="w-100"
            disabled={!product || !confirmed || quantity <= 0 || !expiryDate}
            onClick={handleSubmit}
          >
            Update Inventory
          </Button>

        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminInventoryEntry;
