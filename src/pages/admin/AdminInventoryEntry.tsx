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
  getCategories,
  getBrandsByCategory,
  getNamesByBrand,
  getProductByName
} from "../../services/productService";

import type { Product } from "../../services/productService";
import { adjustInventory } from "../../services/adminInventoryService";

const AdminInventoryEntry: React.FC = () => {
  const [showForm, setShowForm] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);

  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");

  const [product, setProduct] = useState<Product | null>(null);

  const [quantity, setQuantity] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");

  /* ---------- LOAD CATEGORIES ---------- */
  useEffect(() => {
    if (!showForm) return;

    setLoading(true);
    getCategories()
      .then(res => setCategories(res.data))
      .finally(() => setLoading(false));
  }, [showForm]);

  /* ---------- LOAD BRANDS ---------- */
  useEffect(() => {
    if (!category) return;

    setBrand("");
    setName("");
    setProduct(null);

    setLoading(true);
    getBrandsByCategory(category)
      .then(res => setBrands(res.data))
      .finally(() => setLoading(false));
  }, [category]);

  /* ---------- LOAD PRODUCT NAMES ---------- */
  useEffect(() => {
    if (!brand) return;

    setName("");
    setProduct(null);

    setLoading(true);
    getNamesByBrand(brand)
      .then(res => setNames(res.data))
      .finally(() => setLoading(false));
  }, [brand]);

  /* ---------- LOAD PRODUCT DETAILS ---------- */
  useEffect(() => {
    if (!name) return;

    setLoading(true);
    getProductByName(name)
      .then(res => setProduct(res.data))
      .finally(() => setLoading(false));
  }, [name]);

  /* ---------- SUBMIT ---------- */
  const handleSubmit = () => {
    if (!product || product.id == null || !confirmed || quantity <= 0) return;

    adjustInventory(product.id, {
      quantity,
      type: "IN",
      remarks
    }).then(() => {
      setSuccess("✅ Inventory updated successfully");
      closeForm();
    });
  };

  /* ---------- CLOSE ---------- */
  const closeForm = () => {
    setShowForm(false);
    setCategory("");
    setBrand("");
    setName("");
    setProduct(null);
    setQuantity(0);
    setRemarks("");
    setConfirmed(false);
  };

  return (
    <Container className="mt-4" style={{ maxWidth: 520 }}>

      {!showForm && (
        <div className="text-center">
          <Button
            variant="success"
            size="lg"
            onClick={() => setShowForm(true)}
          >
            ➕ Add Inventory Entry
          </Button>
        </div>
      )}

      {showForm && (
        <Card className="shadow mt-3">
          <Card.Body>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <Card.Title>📦 Inventory Entry</Card.Title>
              <Button variant="outline-danger" size="sm" onClick={closeForm}>
                ✖
              </Button>
            </div>

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
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Form.Select>
            </Form.Group>

            {/* BRAND */}
            <Form.Group className="mb-3">
              <Form.Label>Brand</Form.Label>
              <Form.Select
                value={brand}
                disabled={!category}
                onChange={e => setBrand(e.target.value)}
              >
                <option value="">-- Select Brand --</option>
                {brands.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Form.Select>
            </Form.Group>

            {/* PRODUCT NAME */}
            <Form.Group className="mb-3">
              <Form.Label>Product Name</Form.Label>
              <Form.Select
                value={name}
                disabled={!brand}
                onChange={e => setName(e.target.value)}
              >
                <option value="">-- Select Product --</option>
                {names.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
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
              <Form.Control
                type="number"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
              />
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
              disabled={!product || !confirmed || quantity <= 0}
              onClick={handleSubmit}
              className="w-100"
            >
              Update Inventory
            </Button>

          </Card.Body>
        </Card>
      )}
    </Container>
  );
};

export default AdminInventoryEntry;
