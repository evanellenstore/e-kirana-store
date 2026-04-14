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
  getBrandsByCategory,
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
  const [filterCategory, setFilterCategory] = useState("");
  const [filterBrand, setFilterBrand] = useState("");

  /* 📄 Pagination */
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10;

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

  const loadBrandsByCategory = async (categoryId: number) => {
    try {
      setLoadingBrands(true);
      console.log("Loading brands for category ID:", categoryId);
      const response = await getBrandsByCategory(categoryId);
      console.log("Mapped brands:", response.data);
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
      // Find the category ID from the category name
      const categoryObj = categories.find(cat => cat.category === formData.category);
      if (categoryObj) {
        loadBrandsByCategory(categoryObj.id);
      }
    } else {
      setBrands([]);
    }
  }, [formData.category, categories]);

  const openModal = (product?: Product) => {
    setEditing(product || null);
    const productToEdit = product ?? emptyProduct;
    setFormData(productToEdit);
    setInputMode("manual"); // Reset to manual when opening modal
    setBarcodeInput("");
    setScanError(null);
    
    // Load brands for the selected category
    if (productToEdit.category) {
      const categoryObj = categories.find(cat => cat.category === productToEdit.category);
      if (categoryObj) {
        loadBrandsByCategory(categoryObj.id);
      }
    } else {
      setBrands([]);
    }
    
    // Clear externalBarcode when opening modal in manual mode (for new products)
    if (!editing) {
      setFormData(prev => ({ ...prev, externalBarcode: "" }));
    }
    
    setShow(true);
  };

  /**
   * Handle barcode scanning - searches for product by SKU or external barcode
   */
  const handleBarcodeScan = async () => {
    if (!barcodeInput.trim()) {
      setScanError("❌ Please enter a barcode");
      return;
    }

    setBarcodeScanning(true);
    setScanError(null);

    try {
      const response = await getProductByBarcode(barcodeInput.trim());
      const product = response.data;

      // Product found - show "already exists" message
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
      setScanError(`✅ Product already exists! Found: ${product.name} (SKU: ${product.sku})`);
      // Keep in barcode mode to show the message
      setInputMode("barcode");
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
    // Generate dummy unique barcode if not provided (when creating new product)
    const dataToSave = !editing && !formData.externalBarcode
      ? {
          ...formData,
          externalBarcode: `PRD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        }
      : formData;

    const apiCall = editing
      ? updateProduct(editing.id!, dataToSave)
      : createProduct(dataToSave);

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

      const matchCategory = !filterCategory || p.category === filterCategory;
      const matchBrand = !filterBrand || p.brandId?.toString() === filterBrand;

      return matchSearch && matchCategory && matchBrand;
    });
  }, [products, search, filterCategory, filterBrand]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterCategory, filterBrand]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);
  const startIndex = (currentPage - 1) * productsPerPage;
  const endIndex = startIndex + productsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

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

        {/* Search & Filters Section */}
        <div className="admin-product-toolbar">
          <div className="admin-product-search-card">
            <div className="admin-product-search-header">
              <h3 className="admin-product-search-title">🔍 Search & Filter Products</h3>
              <div className="admin-product-count-badge">
                {filteredProducts.length} Products
              </div>
            </div>
            <div className="admin-product-search-body">
              {/* Search Input */}
              <div className="admin-product-search-input-group">
                <Form.Control
                  placeholder="Search by SKU or Product Name"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="admin-product-input"
                />
                <span className="admin-product-search-icon">🔎</span>
              </div>

              {/* Category & Brand Filters */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                marginTop: "12px"
              }}>
                {/* Category Filter */}
                <Form.Group className="mb-0">
                  <Form.Label style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                    📁 Category
                  </Form.Label>
                  <Form.Select
                    value={filterCategory}
                    onChange={e => {
                      setFilterCategory(e.target.value);
                      setFilterBrand(""); // Reset brand when category changes
                      // Load brands for selected category
                      const categoryObj = categories.find(cat => cat.category === e.target.value);
                      if (categoryObj) {
                        loadBrandsByCategory(categoryObj.id);
                      } else {
                        setBrands([]);
                      }
                    }}
                    style={{ fontSize: "13px", padding: "8px 12px" }}
                  >
                    <option value="">All Categories</option>
                    {categories
                      .filter(cat => cat.isActive)
                      .map(cat => (
                        <option key={cat.id} value={cat.category}>
                          {cat.category}
                        </option>
                      ))}
                  </Form.Select>
                </Form.Group>

                {/* Brand Filter */}
                <Form.Group className="mb-0">
                  <Form.Label style={{ fontSize: "12px", fontWeight: "600", marginBottom: "6px" }}>
                    🏷️ Brand
                  </Form.Label>
                  <Form.Select
                    value={filterBrand}
                    onChange={e => setFilterBrand(e.target.value)}
                    disabled={!filterCategory}
                    style={{ fontSize: "13px", padding: "8px 12px" }}
                  >
                    <option value="">All Brands</option>
                    {brands
                      .map(brand => (
                        <option key={brand.id} value={brand.id}>
                          {brand.brand}
                        </option>
                      ))}
                  </Form.Select>
                </Form.Group>
              </div>

              {/* Active Filters Display */}
              {(filterCategory || filterBrand) && (
                <div style={{
                  marginTop: "10px",
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap"
                }}>
                  {filterCategory && (
                    <span style={{
                      background: "#e7f3ff",
                      border: "1px solid #91d5ff",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      color: "#0050b3"
                    }}>
                      📁 {filterCategory}
                      <span 
                        onClick={() => setFilterCategory("")}
                        style={{ marginLeft: "6px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ✕
                      </span>
                    </span>
                  )}
                  {filterBrand && (
                    <span style={{
                      background: "#f6e7ff",
                      border: "1px solid #b37feb",
                      padding: "4px 10px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      color: "#531dab"
                    }}>
                      🏷️ {brands.find(b => b.id.toString() === filterBrand)?.brand || ""}
                      <span 
                        onClick={() => setFilterBrand("")}
                        style={{ marginLeft: "6px", cursor: "pointer", fontWeight: "bold" }}
                      >
                        ✕
                      </span>
                    </span>
                  )}
                </div>
              )}
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
          {paginatedProducts.map(p => (
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

        {/* Pagination Controls */}
        {filteredProducts.length > 0 && (
          <div style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "12px",
            marginTop: "32px",
            padding: "20px",
            background: "#f8f9fa",
            borderRadius: "10px"
          }}>
            {/* Previous Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              style={{
                padding: "8px 16px",
                background: currentPage === 1 ? "#e9ecef" : "#667eea",
                color: currentPage === 1 ? "#999" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "13px"
              }}
            >
              ← Previous
            </button>

            {/* Page Numbers */}
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  style={{
                    padding: "8px 12px",
                    background: currentPage === page ? "#667eea" : "#fff",
                    color: currentPage === page ? "white" : "#333",
                    border: currentPage === page ? "none" : "1px solid #ddd",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontWeight: currentPage === page ? "600" : "500",
                    fontSize: "13px"
                  }}
                >
                  {page}
                </button>
              ))}
            </div>

            {/* Next Button */}
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              style={{
                padding: "8px 16px",
                background: currentPage === totalPages ? "#e9ecef" : "#667eea",
                color: currentPage === totalPages ? "#999" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                fontWeight: "600",
                fontSize: "13px"
              }}
            >
              Next →
            </button>

            {/* Page Info */}
            <div style={{
              marginLeft: "16px",
              fontSize: "13px",
              fontWeight: "500",
              color: "#666",
              paddingLeft: "16px",
              borderLeft: "2px solid #ddd"
            }}>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              <br />
              <span style={{ fontSize: "12px", color: "#999" }}>
                Showing {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} of {filteredProducts.length}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Product Modal */}
      <Modal show={show} onHide={() => setShow(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Product" : "Add New Product"}</Modal.Title>
        </Modal.Header>

        <Modal.Body className="admin-product-modal-body">
          {/* Input Mode Selection - Compact */}
          {!editing && (
            <div className="mb-2">
              <div style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                padding: "8px 12px",
                borderRadius: "6px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px",
                color: "white"
              }}>
                {/* Manual Entry Option */}
                <div
                  onClick={() => {
                    setInputMode("manual");
                    setScanError(null);
                    setBarcodeInput("");
                    // Clear externalBarcode when switching to manual mode
                    setFormData(prev => ({ ...prev, externalBarcode: "" }));
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: inputMode === "manual" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                    border: inputMode === "manual" ? "1px solid white" : "1px solid transparent",
                    fontSize: "12px",
                    fontWeight: "500",
                    textAlign: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  ✏️ Manual
                </div>

                {/* Barcode Scan Option */}
                <div
                  onClick={() => {
                    setInputMode("barcode");
                    setScanError(null);
                  }}
                  style={{
                    padding: "6px 8px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: inputMode === "barcode" ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.08)",
                    border: inputMode === "barcode" ? "1px solid white" : "1px solid transparent",
                    fontSize: "12px",
                    fontWeight: "500",
                    textAlign: "center",
                    transition: "all 0.2s ease"
                  }}
                >
                  📱 Scan
                </div>
              </div>
            </div>
          )}

          {/* Barcode Scanner Section - Enhanced UI */}
          {!editing && inputMode === "barcode" && (
            <div className="mb-4" style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              padding: "24px",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(102, 126, 234, 0.3)"
            }}>
              {/* Header */}
              <div style={{
                color: "white",
                marginBottom: "16px"
              }}>
                <h5 style={{ margin: 0, fontWeight: 600, fontSize: "16px" }}>📱 Scan Product Barcode</h5>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", opacity: 0.9 }}>
                  Scan SKU or external barcode to quickly find existing products
                </p>
              </div>

              {/* Input Section */}
              <div style={{
                background: "white",
                padding: "16px",
                borderRadius: "10px",
                marginBottom: "12px"
              }}>
                <Form.Group className="mb-0">
                  <Form.Control
                    placeholder="Enter or scan barcode..."
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
                    style={{
                      fontSize: "14px",
                      padding: "12px 14px",
                      border: "2px solid #e0e0e0",
                      borderRadius: "8px",
                      height: "44px",
                      fontWeight: "500"
                    }}
                  />
                </Form.Group>

                {/* Action Button */}
                <button
                  className="btn w-100"
                  onClick={handleBarcodeScan}
                  disabled={!barcodeInput || barcodeScanning}
                  style={{
                    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 16px",
                    fontSize: "14px",
                    fontWeight: "600",
                    cursor: barcodeInput && !barcodeScanning ? "pointer" : "not-allowed",
                    opacity: barcodeInput && !barcodeScanning ? 1 : 0.6,
                    marginTop: "10px",
                    transition: "all 0.3s ease"
                  }}
                >
                  {barcodeScanning ? (
                    <>
                      <Spinner animation="border" size="sm" style={{ width: "14px", height: "14px", marginRight: "8px" }} />
                      Searching...
                    </>
                  ) : (
                    "🔍 Search Product"
                  )}
                </button>
              </div>

              {/* Status Message */}
              {scanError && (
                <div style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  background: scanError.includes("already exists") ? "#cfe2ff" : scanError.includes("✅") ? "#d4edda" : scanError.includes("❌") ? "#f8d7da" : "#fff3cd",
                  border: `2px solid ${scanError.includes("already exists") ? "#b6d4fe" : scanError.includes("✅") ? "#c3e6cb" : scanError.includes("❌") ? "#f5c6cb" : "#ffeeba"}`,
                  color: scanError.includes("already exists") ? "#084298" : scanError.includes("✅") ? "#155724" : scanError.includes("❌") ? "#721c24" : "#856404",
                  fontSize: "13px",
                  fontWeight: "500"
                }}>
                  <div style={{ marginBottom: "8px" }}>{scanError}</div>
                  {scanError.includes("already exists") && (
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        className="btn btn-sm flex-grow-1"
                        onClick={() => {
                          setBarcodeInput("");
                          setScanError(null);
                          setInputMode("barcode");
                        }}
                        style={{
                          background: "#6c757d",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}
                      >
                        🔄 Scan Another
                      </button>
                      <button
                        className="btn btn-sm flex-grow-1"
                        onClick={() => {
                          setInputMode("manual");
                          // Clear externalBarcode when switching from barcode to manual mode
                          setFormData(prev => ({ ...prev, externalBarcode: "" }));
                        }}
                        style={{
                          background: "#0d6efd",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: "600"
                        }}
                      >
                        👁️ View Details
                      </button>
                    </div>
                  )}
                  {scanError.includes("not found") && (
                    <button
                      className="btn btn-sm w-100"
                      onClick={() => setInputMode("manual")}
                      style={{
                        background: "#667eea",
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: "600"
                      }}
                    >
                      ➕ Create New Product
                    </button>
                  )}
                </div>
              )}

              {/* Helper Text */}
              {!scanError && (
                <div style={{
                  color: "rgba(255, 255, 255, 0.85)",
                  fontSize: "12px",
                  display: "flex",
                  gap: "8px",
                  alignItems: "center"
                }}>
                  <span>💡</span>
                  <span>Accepts SKU or barcode format (press Enter or click Search)</span>
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
            <Form.Label className="admin-product-form-label">🏷️ Brand *</Form.Label>
            {!formData.category ? (
              <Form.Select disabled className="admin-product-form-select">
                <option value="">👆 Select Category First</option>
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
                <option value="">-- Select Brand --</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.brand}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <div className="admin-product-warning-info">
                ⚠️ No brands mapped to this category
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
              type="text"
              placeholder="Enter price"
              value={formData.price || ""}
              onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
              className="admin-product-form-input"
            />
          </Form.Group>

          {/* Discount */}
          <Form.Group className="mb-3">
            <Form.Label className="admin-product-form-label">Discount (₹)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter discount amount"
              value={formData.discountAmount || ""}
              onChange={e => setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })}
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

          {/* External Barcode Field - Show for both creating and editing */}
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
              {editing 
                ? "Edit the barcode number for this product."
                : "Unique barcode number for quick lookup (e.g., manufacturer barcode). If not provided, a unique barcode will be auto-generated (PRD-timestamp-random)."
              }
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
