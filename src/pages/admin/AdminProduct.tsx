import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Modal,
  Form,
  Spinner
} from "react-bootstrap";
import AdminHeader from "../../components/AdminHeader";
import api from "../../services/api";
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getActiveBrands,
  getProductByBarcode,
  type Product,
  type Brand
} from "../../services/productService";
import "./AdminProduct.css";

interface Category {
  id: number;
  category: string;
  isActive: boolean;
}

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBrands, setLoadingBrands] = useState(false);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  /* 🔍 Filters */
  const [search, setSearch] = useState("");

  const emptyProduct: Product = {
    sku: "",
    name: "",
    description: "",
    category: "",
    brandId: undefined,
    unit: "",
    price: 0,
    discountAmount: 0,
    status: "ACTIVE",
    externalBarcode: ""
  };

  const [formData, setFormData] = useState<Product>(emptyProduct);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  // Barcode scanner state
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  
  // Input mode: "manual" or "barcode"
  const [inputMode, setInputMode] = useState<"manual" | "barcode">("manual");

  const loadProducts = () => {
    setLoading(true);
    getAllProducts()
      .then(res => setProducts(res.data))
      .finally(() => setLoading(false));
  };

  const loadCategories = async () => {
    try {
      const response = await api.get("/products/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Failed to load categories", error);
    }
  };

  const loadBrandsByCategory = async () => {
    try {
      setLoadingBrands(true);
      console.log("Loading all active brands");
      const response = await getActiveBrands();
      console.log("Brands response:", response.data);
      setBrands(response.data || []);
    } catch (error) {
      console.error("Failed to load brands:", error);
      setBrands([]);
    } finally {
      setLoadingBrands(false);
    }
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // Load brands when category changes in form
  useEffect(() => {
    if (formData.category) {
      loadBrandsByCategory();
    } else {
      setBrands([]);
    }
  }, [formData.category]);

  const openModal = (product?: Product) => {
    setEditing(product || null);
    const productToEdit = product ?? emptyProduct;
    setFormData(productToEdit);
    setInputMode("manual"); // Reset to manual when opening modal
    setBarcodeInput("");
    setScanError(null);
    
    // Load brands for the selected category
    if (productToEdit.category) {
      loadBrandsByCategory();
    } else {
      setBrands([]);
    }
    
    setShow(true);
  };

  /**
   * Handle barcode scanning - searches for product by SKU or external barcode
   */
  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      setScanError("Please enter a barcode");
      return;
    }

    setBarcodeScanning(true);
    setScanError(null);

    try {
      const response = await getProductByBarcode(barcodeInput.trim());
      const product = response.data;

      // Pre-fill the form with scanned product data
      setFormData({
        ...product,
        sku: product.sku || "",
        name: product.name || "",
        description: product.description || "",
        category: product.category || "",
        brandId: product.brandId || undefined,
        brandName: product.brandName || "",
        unit: product.unit || "",
        price: product.price || 0,
        discountAmount: product.discountAmount || 0,
        status: product.status || "ACTIVE",
        externalBarcode: product.externalBarcode || ""
      });

      setBarcodeInput("");
      setScanError(null);
      // Switch to manual mode to show product details
      setInputMode("manual");
    } catch (error: any) {
      // Product not found - set external barcode and switch to manual mode
      const scannedBarcode = barcodeInput.trim();
      
      // Pre-fill with external barcode and empty form
      setFormData({
        ...emptyProduct,
        externalBarcode: scannedBarcode
      });

      setScanError(`✅ Barcode "${scannedBarcode}" not found. Let's create a new product with this barcode!`);
      
      // Switch to manual mode so user can fill details
      setInputMode("manual");
      setBarcodeInput("");
    } finally {
      setBarcodeScanning(false);
    }
  };

  const saveProduct = () => {
    const apiCall = editing
      ? updateProduct(editing.id!, formData)
      : createProduct(formData);

    apiCall.then(() => {
      loadProducts();
      setShow(false);
    });
  };

  const removeProduct = (id?: number) => {
    if (!id) return;
    if (window.confirm("Delete this product?")) {
      deleteProduct(id).then(loadProducts);
    }
  };

  /* brand/category filters removed */

  /* 🔎 Filter logic */
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());

      return matchSearch;
    });
  }, [products, search]);

  if (loading) {
    return (
      <div className="admin-product-loading-container">
        <div className="admin-product-spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="admin-product-page-container">
      <div className="admin-product-content">
        <AdminHeader 
          title="Product Management"
          description="Create, edit, and manage all products in your system"
        />

        {/* Search & Add Product Section */}
        <div className="admin-product-toolbar">
          <div className="admin-product-search-card">
            <div className="admin-product-search-header">
              <h3 className="admin-product-search-title">🔍 Search Products</h3>
              <div className="admin-product-count-badge">
                {filteredProducts.length} Products
              </div>
            </div>
            <div className="admin-product-search-body">
              <div className="admin-product-search-input-group">
                <Form.Control
                  placeholder="Search by SKU or Product Name"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="admin-product-input"
                />
                <span className="admin-product-search-icon">🔎</span>
              </div>
            </div>
          </div>

          <button
            className="admin-product-add-btn"
            onClick={() => openModal()}
          >
            <span className="add-icon">+</span>
            <span className="add-text">Add Product</span>
          </button>
        </div>

        {/* Products Grid */}
        <div className="admin-product-grid">
          {filteredProducts.map(p => (
            <div key={p.id} className="admin-product-card">
              <div className="admin-product-card-header">
                <div className="admin-product-card-title-section">
                  <h4 className="admin-product-name">{p.name}</h4>
                  <div className="admin-product-sku">SKU: {p.sku}</div>
                </div>
                <Badge 
                  className={`admin-product-status-badge ${p.status === "ACTIVE" ? "badge-active" : "badge-inactive"}`}
                >
                  {p.status}
                </Badge>
              </div>

              <div className="admin-product-card-body">
                <div className="admin-product-info-grid">
                  <div className="admin-product-info-item">
                    <span className="info-label">ID</span>
                    <span className="info-value">{p.id}</span>
                  </div>
                  <div className="admin-product-info-item">
                    <span className="info-label">Category</span>
                    <span className="info-value">{p.category || "N/A"}</span>
                  </div>
                  <div className="admin-product-info-item">
                    <span className="info-label">Brand</span>
                    <span className="info-value">{p.brandName || "N/A"}</span>
                  </div>
                  <div className="admin-product-info-item">
                    <span className="info-label">Unit</span>
                    <span className="info-value">{p.unit || "N/A"}</span>
                  </div>
                </div>

                <div className="admin-product-pricing-section">
                  <div className="price-item">
                    <span className="price-label">Price</span>
                    <span className="price-value">₹{p.price}</span>
                  </div>
                  {p.discountAmount ? (
                    <div className="discount-item">
                      <span className="discount-label">Discount</span>
                      <span className="discount-value">₹{p.discountAmount}</span>
                    </div>
                  ) : null}
                </div>

                {p.barcode && (
                  <div className="admin-product-barcode-section">
                    <img
                      src={`data:image/png;base64,${p.barcode}`}
                      alt="barcode"
                      className="admin-product-barcode-img"
                      onClick={() => { setBarcodePreview(p.barcode || null); setShowBarcodeModal(true); }}
                    />
                  </div>
                )}

                {p.description && (
                  <div className="admin-product-description">
                    <p>{p.description}</p>
                  </div>
                )}
              </div>

              <div className="admin-product-card-footer">
                <button 
                  className="admin-product-btn admin-product-btn-edit"
                  onClick={() => openModal(p)}
                >
                  ✏️ Edit
                </button>
                <button 
                  className="admin-product-btn admin-product-btn-delete"
                  onClick={() => removeProduct(p.id)}
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="admin-product-empty-state">
            <div className="admin-product-empty-icon">📭</div>
            <p className="admin-product-empty-text">No products found</p>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Product" : "Add New Product"}</Modal.Title>
        </Modal.Header>

        <Modal.Body className="admin-product-modal-body">
          {/* Input Mode Toggle - Only for Adding New Products */}
          {!editing && (
            <div className="mb-4 p-3 border rounded" style={{ backgroundColor: "#e7f3ff" }}>
              <h6 className="mb-3">Choose Input Method</h6>
              <div className="d-flex gap-3">
                <Form.Check
                  type="radio"
                  label="✏️ Manual Entry (Enter all details)"
                  name="inputMode"
                  id="admin-manual-mode"
                  checked={inputMode === "manual"}
                  onChange={() => {
                    setInputMode("manual");
                    setScanError(null);
                    setBarcodeInput("");
                  }}
                />
                <Form.Check
                  type="radio"
                  label="📱 Barcode Scan (Scan or enter barcode)"
                  name="inputMode"
                  id="admin-barcode-mode"
                  checked={inputMode === "barcode"}
                  onChange={() => {
                    setInputMode("barcode");
                    setScanError(null);
                  }}
                />
              </div>
            </div>
          )}

          {/* Barcode Scanner Section */}
          {!editing && inputMode === "barcode" && (
            <div className="mb-4 p-3 border rounded" style={{ backgroundColor: "#f8f9fa" }}>
              <h6 className="mb-3">📱 Barcode Scanner</h6>
              <Form.Group className="mb-2">
                <Form.Label>Scan or Enter External Barcode</Form.Label>
                <Form.Control
                  placeholder="Scan barcode here..."
                  value={barcodeInput}
                  onChange={(e) => {
                    setBarcodeInput(e.target.value);
                    setScanError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleBarcodeScan();
                    }
                  }}
                  disabled={barcodeScanning}
                  autoFocus
                />
                <small className="form-text text-muted">
                  Press Enter to scan or search by SKU/external barcode
                </small>
              </Form.Group>

              <button
                className="btn btn-primary btn-sm"
                onClick={handleBarcodeScan}
                disabled={!barcodeInput || barcodeScanning}
              >
                {barcodeScanning ? "Scanning..." : "🔍 Search Barcode"}
              </button>

              {scanError && (
                <div className={`alert mt-2 mb-0 ${scanError.includes("✅") ? "alert-success" : "alert-warning"}`}>
                  <div>{scanError}</div>
                  {scanError.includes("✅") && (
                    <div className="mt-2">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => setInputMode("manual")}
                      >
                        ➕ Create Product with this Barcode
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Form Fields - Only show in manual mode or when editing */}
          {editing || inputMode === "manual" ? (
            <>
          {/* Category */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Category *</Form.Label>
            <Form.Select
              value={formData.category}
              onChange={e => {
                const selectedCategory = e.target.value;
                setFormData(prev => ({ ...prev, category: selectedCategory, brandId: undefined, brandName: undefined }));
              }}
              className="admin-product-form-select"
            >
              <option value="">Select a category</option>
              {categories
                .filter(cat => cat.isActive)
                .map(cat => (
                  <option key={cat.id} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
            </Form.Select>
          </Form.Group>

          {/* Brand */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Brand *</Form.Label>
            {!formData.category ? (
              <Form.Select disabled className="admin-product-form-select">
                <option value="">Select category first</option>
              </Form.Select>
            ) : loadingBrands ? (
              <div className="admin-product-loading-info">
                <Spinner animation="border" size="sm" className="me-2" />
                Loading brands...
              </div>
            ) : brands.length > 0 ? (
              <Form.Select
                value={formData.brandId ?? ""}
                onChange={e => {
                  const selectedId = e.target.value ? Number(e.target.value) : undefined;
                  const selectedBrand = brands.find(b => b.id === selectedId);
                  setFormData({ 
                    ...formData, 
                    brandId: selectedId,
                    brandName: selectedBrand?.brand
                  })
                }}
                className="admin-product-form-select"
              >
                <option value="">Select a brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.brand}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <div className="admin-product-warning-info">
                No brands available
              </div>
            )}
          </Form.Group>

          {/* Product Name */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Product Name *</Form.Label>
            <Form.Control
              placeholder="Enter product name"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* SKU */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">SKU</Form.Label>
            <Form.Control
              placeholder="Enter SKU"
              value={formData.sku}
              onChange={e => setFormData({ ...formData, sku: e.target.value })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Unit */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Unit *</Form.Label>
            <Form.Control
              placeholder="e.g., kg, liters, pieces"
              value={formData.unit}
              onChange={e => setFormData({ ...formData, unit: e.target.value })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Price */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Price (₹) *</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter price"
              value={formData.price}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Discount */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Discount (₹)</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter discount amount"
              min="0"
              step="0.01"
              value={formData.discountAmount || 0}
              onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Description */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter product description"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Status */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Status</Form.Label>
            <Form.Select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as any })}
              className="admin-product-form-select"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Form.Select>
          </Form.Group>

          {/* External Barcode Field */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">External Barcode</Form.Label>
            <Form.Control
              placeholder="External Barcode Number (optional)"
              value={formData.externalBarcode || ""}
              onChange={e =>
                setFormData({ ...formData, externalBarcode: e.target.value })
              }
              className="admin-product-form-input"
            />
            <small className="form-text text-muted">
              Unique barcode number for quick lookup (e.g., manufacturer barcode)
            </small>
          </Form.Group>
            </>
          ) : null}
        </Modal.Body>

        <Modal.Footer className="admin-product-modal-footer">
          <button 
            className="admin-product-modal-btn admin-product-modal-btn-cancel"
            onClick={() => setShow(false)}
          >
            Cancel
          </button>
          <button 
            className="admin-product-modal-btn admin-product-modal-btn-save"
            onClick={saveProduct}
          >
            {editing ? '💾 Update' : '➕ Create'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* Barcode Preview Modal */}
      <Modal show={showBarcodeModal} onHide={() => setShowBarcodeModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Barcode Preview</Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center">
          {barcodePreview ? (
            <>
              <img src={`data:image/png;base64,${barcodePreview}`} alt="barcode" style={{maxWidth: '100%'}} />
              <div className="mt-3">
                <a href={`data:image/png;base64,${barcodePreview}`} download="barcode.png" className="btn btn-outline-primary btn-sm">Download</a>
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

export default AdminProducts;
