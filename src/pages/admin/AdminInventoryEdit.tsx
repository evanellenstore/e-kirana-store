import React, { useEffect, useState } from "react";
import {
  getInventory,
  adjustInventory,
  reserveInventory,
  releaseInventory,
  getBatches,
  getAllReservedItems,
  type InventoryStatus,
  type BatchInfo,
  type ReservedItem
} from "../../services/inventoryService";
import {
  getActiveCategories,
  getActiveBrands,
  getBrandsByCategory,
  getNamesByBrand,
  getProductBySku,
  type Category,
  type Brand
} from "../../services/productService";
import "./AdminInventoryEdit.css";

type ActionType = "adjust" | "reserve" | "release";

const AdminInventoryEdit: React.FC = () => {
  const PRODUCT_ID = 1; // later make dynamic

  // ============================================
  // DATA STATES
  // ============================================
  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [reservedItems, setReservedItems] = useState<ReservedItem[]>([]);
  
  // CASCADING DROPDOWN STATES
  const [categories, setCategories] = useState<Category[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [filteredBrands, setFilteredBrands] = useState<Brand[]>([]);
  const [productSkus, setProductSkus] = useState<string[]>([]);
  // selectedProduct removed - no longer needed for display

  // ============================================
  // UI STATES
  // ============================================
  const [selectedAction, setSelectedAction] = useState<ActionType>("adjust");
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cascadeLoading, setCascadeLoading] = useState(false);

  // ============================================
  // CASCADE FORM STATES (for reserve)
  // ============================================
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [selectedProductName, setSelectedProductName] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [cascadeBatches, setCascadeBatches] = useState<BatchInfo[]>([]);
  const [selectedCascadeBatchNo, setSelectedCascadeBatchNo] = useState<string>("");

  // ============================================
  // FORM STATES
  // ============================================
  const [quantity, setQuantity] = useState<string>("0");
  const [remarks, setRemarks] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [selectedBatchNo, setSelectedBatchNo] = useState<string>("");
  const [selectedReleaseItem, setSelectedReleaseItem] = useState<string>("");

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  const showMessage = (type: "success" | "error", message: string) => {
    if (type === "success") {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(message);
    }
  };

  const resetForm = () => {
    setQuantity("0");
    setRemarks("");
    setReferenceId("");
  };

  // ============================================
  // DATA LOADING FUNCTIONS
  // ============================================

  const loadInventory = async () => {
    try {
      const res = await getInventory(PRODUCT_ID);
      setInventory(res.data);
    } catch (err) {
      console.error("Failed to load inventory:", err);
      setError("Failed to load inventory data");
    }
  };

  const loadBatches = async () => {
    try {
      const res = await getBatches(PRODUCT_ID);
      const batchesData = res.data || [];
      setBatches(batchesData);
      if (batchesData.length > 0) {
        setSelectedBatchNo(batchesData[0].batchNo);
      }
    } catch (err) {
      console.error("Failed to load batches:", err);
      setBatches([]);
    }
  };

  const loadReservedItems = async () => {
    try {
      // ✅ Load ALL reserved items from all products
      const res = await getAllReservedItems();
      const itemsData = res.data || [];
      
      if (itemsData.length > 0) {
        setReservedItems(itemsData);
        setSelectedReleaseItem(itemsData[0].referenceId);
      } else {
        // No reserved items found
        setReservedItems([]);
        setSelectedReleaseItem("");
      }
    } catch (err) {
      console.error("Failed to load reserved items:", err);
      // If API fails, clear reserved items
      setReservedItems([]);
      setSelectedReleaseItem("");
    }
  };

  // ============================================
  // ACTION HANDLERS
  // ============================================

  const handleAdjustInventory = async (type: "IN" | "OUT") => {
    const qty = parseInt(quantity);
    if (qty <= 0) {
      setError("Please enter a valid quantity");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await adjustInventory(PRODUCT_ID, qty, type, remarks);
      showMessage("success", `Inventory ${type === "IN" ? "added" : "removed"} successfully`);
      resetForm();
      await loadInventory();
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || `Failed to ${type === "IN" ? "add" : "remove"} inventory`;
      showMessage("error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReserveInventory = async () => {
    const qty = parseInt(quantity);
    if (qty <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    if (!referenceId.trim()) {
      setError("Please enter a reference ID");
      return;
    }
    if (!selectedBatchNo) {
      setError("Please select a batch");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await reserveInventory(PRODUCT_ID, qty, referenceId, selectedBatchNo);
      showMessage("success", "Inventory reserved successfully!");
      resetForm();
      await Promise.all([loadInventory(), loadBatches(), loadReservedItems()]);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to reserve inventory";
      showMessage("error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleReleaseInventory = async () => {
    const qty = parseInt(quantity);
    if (qty <= 0) {
      setError("Please enter a valid quantity");
      return;
    }
    if (!selectedReleaseItem.trim()) {
      setError("Please select a reserved item to release");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const selectedItem = reservedItems.find(i => i.referenceId === selectedReleaseItem);
      const productId = selectedItem?.productId || PRODUCT_ID;
      console.log("Releasing inventory:", { selectedItem, productId, qty, referenceId: selectedReleaseItem });
      await releaseInventory(productId, qty, selectedReleaseItem);
      showMessage("success", "Inventory released successfully!");
      setQuantity("0");
      await Promise.all([loadInventory(), loadBatches(), loadReservedItems()]);
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to release inventory";
      showMessage("error", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // CASCADE DROPDOWN HANDLERS (for reserve)
  // ============================================

  const loadCascadeCategories = async () => {
    try {
      setCascadeLoading(true);
      const res = await getActiveCategories();
      setCategories(res.data || []);
    } catch (err) {
      console.error("Failed to load categories:", err);
      setCategories([]);
    } finally {
      setCascadeLoading(false);
    }
  };

  const loadAllBrands = async () => {
    try {
      setCascadeLoading(true);
      const res = await getActiveBrands();
      setAllBrands(res.data || []);
    } catch (err) {
      console.error("Failed to load brands:", err);
      setAllBrands([]);
    } finally {
      setCascadeLoading(false);
    }
  };

  const handleCategoryChange = (categoryName: string) => {
    setSelectedCategory(categoryName);
    setSelectedBrand("");
    setSelectedProductName("");
    setSelectedProductId(null);
    setProductSkus([]);
    setCascadeBatches([]);
    setSelectedCascadeBatchNo("");

    if (!categoryName) {
      setFilteredBrands([]);
      return;
    }

    // Filter brands by category
    try {
      setCascadeLoading(true);
      getBrandsByCategory(categoryName)
        .then((res) => {
          const brandNames = res.data || [];
          const filtered = allBrands.filter(b => brandNames.includes(b.brand));
          setFilteredBrands(filtered);
        })
        .catch((err) => {
          console.error("Failed to filter brands:", err);
          setFilteredBrands([]);
        })
        .finally(() => setCascadeLoading(false));
    } catch (err) {
      console.error("Failed to filter brands:", err);
      setFilteredBrands([]);
      setCascadeLoading(false);
    }
  };

  const handleBrandChange = (brandId: string) => {
    const brand = allBrands.find(b => b.id === Number(brandId));
    setSelectedBrand(brandId);
    setSelectedProductName("");
    setSelectedProductId(null);
    setCascadeBatches([]);
    setSelectedCascadeBatchNo("");

    if (!brandId || !brand) {
      setProductSkus([]);
      return;
    }

    try {
      setCascadeLoading(true);
      getNamesByBrand(Number(brandId))
        .then((res) => {
          setProductSkus(res.data || []);
        })
        .catch((err) => {
          console.error("Failed to load product names:", err);
          setProductSkus([]);
        })
        .finally(() => setCascadeLoading(false));
    } catch (err) {
      console.error("Failed to load product names:", err);
      setProductSkus([]);
      setCascadeLoading(false);
    }
  };

  const handleProductChange = (sku: string) => {
    setSelectedProductName(sku);
    setCascadeBatches([]);
    setSelectedCascadeBatchNo("");

    if (!sku) {
      setSelectedProductId(null);
      return;
    }

    try {
      setCascadeLoading(true);
      getProductBySku(sku)
        .then((res) => {
          const product = res.data;
          if (product && product.id) {
            setSelectedProductId(product.id);

            // Load batches for this product
            return getBatches(product.id);
          }
          return Promise.reject("Product not found");
        })
        .then((res) => {
          setCascadeBatches(res.data || []);
          if (res.data && res.data.length > 0) {
            setSelectedCascadeBatchNo(res.data[0].batchNo);
          }
        })
        .catch((err) => {
          console.error("Failed to load product or batches:", err);
          setSelectedProductId(null);
          setCascadeBatches([]);
        })
        .finally(() => setCascadeLoading(false));
    } catch (err) {
      console.error("Failed to load product:", err);
      setSelectedProductId(null);
      setCascadeLoading(false);
    }
  };

  // ============================================
  // LIFECYCLE
  // ============================================

  useEffect(() => {
    const loadAllData = async () => {
      setLoading(true);
      await Promise.all([
        loadInventory(),
        loadBatches(),
        loadReservedItems(),
        loadCascadeCategories(),
        loadAllBrands()
      ]);
      setLoading(false);
    };
    loadAllData();
  }, []);

  // ✅ Load reserved items when Release tab is selected
  useEffect(() => {
    if (selectedAction === "release") {
      loadReservedItems();
    }
  }, [selectedAction]);

  // ============================================
  // RENDER - LOADING STATE
  // ============================================

  if (loading && !inventory) {
    return (
      <div className="edit-inventory-loading">
        <div className="spinner">
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">Loading inventory...</p>
      </div>
    );
  }

  // ============================================
  // RENDER - MAIN
  // ============================================

  return (
    <div className="edit-inventory-container">
      <h2 className="edit-title">📦 Inventory Management</h2>

      {/* Alert Messages */}
      {error && (
        <div className="alert-message alert-danger">
          <span className="alert-icon">⚠️</span>
          <span className="alert-text">{error}</span>
          <button className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {success && (
        <div className="alert-message alert-success">
          <span className="alert-icon">✓</span>
          <span className="alert-text">{success}</span>
          <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
        </div>
      )}

      {/* Inventory Stats */}
      {inventory && (
        <div className="inventory-stats">
          <div className="stat-card available">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <h3 className="stat-label">Available Quantity</h3>
              <p className="stat-value">{inventory.availableQty}</p>
              <p className="stat-description">Ready for dispatch</p>
            </div>
          </div>

          <div className="stat-card reserved">
            <div className="stat-icon">🔒</div>
            <div className="stat-content">
              <h3 className="stat-label">Reserved Quantity</h3>
              <p className="stat-value">{inventory.reservedQty}</p>
              <p className="stat-description">Currently reserved</p>
            </div>
          </div>

          <div className="stat-card total">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3 className="stat-label">Total Quantity</h3>
              <p className="stat-value">{(inventory.availableQty || 0) + (inventory.reservedQty || 0)}</p>
              <p className="stat-description">Available + Reserved</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Tabs */}
      <div className="action-tabs">
        <button
          className={`action-tab ${selectedAction === "adjust" ? "active" : ""}`}
          onClick={() => {
            setSelectedAction("adjust");
            setError(null);
          }}
        >
          <span className="tab-icon">🔄</span>
          <span className="tab-label">Adjust Inventory</span>
        </button>
        <button
          className={`action-tab ${selectedAction === "reserve" ? "active" : ""}`}
          onClick={() => {
            setSelectedAction("reserve");
            setError(null);
          }}
        >
          <span className="tab-icon">🔒</span>
          <span className="tab-label">Reserve Stock</span>
        </button>
        <button
          className={`action-tab ${selectedAction === "release" ? "active" : ""}`}
          onClick={() => {
            setSelectedAction("release");
            setError(null);
            // ✅ Reload reserved items when clicking Release tab
            loadReservedItems();
          }}
        >
          <span className="tab-icon">🔓</span>
          <span className="tab-label">Release Stock</span>
        </button>
      </div>

      {/* ADJUST ACTION */}
      {selectedAction === "adjust" && (
        <div className="action-form adjust-form">
          <div className="form-header">
            <h3>🔄 Adjust Inventory (Add or Remove Stock)</h3>
            <p className="form-description">Increase or decrease inventory quantity with remarks</p>
          </div>

          <form className="form-grid">
            <div className="form-group">
              <label htmlFor="qty-adjust" className="form-label">Quantity *</label>
              <input
                id="qty-adjust"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Enter quantity"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label htmlFor="remarks-adjust" className="form-label">Remarks</label>
              <input
                id="remarks-adjust"
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g., Warehouse stock check, Damage noted"
                className="form-input"
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => handleAdjustInventory("IN")}
                disabled={loading || parseInt(quantity) <= 0}
                className="btn btn-success"
              >
                <span className="btn-icon">➕</span>
                <span className="btn-text">Add to Stock (IN)</span>
              </button>
              <button
                type="button"
                onClick={() => handleAdjustInventory("OUT")}
                disabled={loading || parseInt(quantity) <= 0}
                className="btn btn-danger"
              >
                <span className="btn-icon">➖</span>
                <span className="btn-text">Remove from Stock (OUT)</span>
              </button>
            </div>
          </form>

          <div className="form-info">
            <div className="info-item">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">Use "IN" to add stock from suppliers, "OUT" to remove damaged or expired items</span>
            </div>
          </div>
        </div>
      )}

      {/* RESERVE ACTION */}
      {selectedAction === "reserve" && (
        <div className="action-form reserve-form">
          <div className="form-header">
            <h3>🔒 Reserve Stock for Order</h3>
            <p className="form-description">Reserve inventory for pending orders or sales</p>
          </div>

          {/* CASCADE DROPDOWN SECTION */}
          <div style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #dee2e6" }}>
            <h4 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 700 }}>📋 Step 1: Select Product Using Cascading Dropdowns</h4>
            
            <form className="form-grid" style={{ gap: "1rem" }}>
              {/* CATEGORY DROPDOWN */}
              <div className="form-group">
                <label htmlFor="cascade-category" className="form-label">Category *</label>
                <select
                  id="cascade-category"
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="form-input"
                  disabled={cascadeLoading || categories.length === 0}
                >
                  <option value="">-- Select Category --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.category}>
                      {cat.category}
                    </option>
                  ))}
                </select>
              </div>

              {/* BRAND DROPDOWN */}
              <div className="form-group">
                <label htmlFor="cascade-brand" className="form-label">Brand *</label>
                <select
                  id="cascade-brand"
                  value={selectedBrand}
                  onChange={(e) => handleBrandChange(e.target.value)}
                  className="form-input"
                  disabled={!selectedCategory || cascadeLoading || filteredBrands.length === 0}
                >
                  <option value="">-- Select Brand --</option>
                  {filteredBrands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.brand}
                    </option>
                  ))}
                </select>
              </div>

              {/* PRODUCT DROPDOWN */}
              <div className="form-group">
                <label htmlFor="cascade-product" className="form-label">Product *</label>
                <select
                  id="cascade-product"
                  value={selectedProductName}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="form-input"
                  disabled={!selectedBrand || cascadeLoading || productSkus.length === 0}
                >
                  <option value="">-- Select Product --</option>
                  {productSkus.map((sku, idx) => (
                    <option key={idx} value={sku}>
                      {sku}
                    </option>
                  ))}
                </select>
              </div>

              {/* LOADING INDICATOR */}
              {cascadeLoading && (
                <div style={{ padding: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                  ⏳ Loading...
                </div>
              )}
            </form>

            {/* Only Batch Dropdown - Product Details Removed */}
          </div>

          {/* BATCH SELECTION DROPDOWN ONLY */}
          {selectedProductId && (
            <>
              <form className="form-grid">
                <div className="form-group">
                  <label htmlFor="batch-reserve-cascade" className="form-label">Select Batch *</label>
                  <select
                    id="batch-reserve-cascade"
                    value={selectedCascadeBatchNo}
                    onChange={(e) => setSelectedCascadeBatchNo(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Choose a batch --</option>
                    {cascadeBatches.map((batch, index) => (
                      <option key={index} value={batch.batchNo}>
                        {batch.batchNo} (Available: {batch.availableQty}, Expiry: {typeof batch.expiryDate === 'string' ? batch.expiryDate : new Date(batch.expiryDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="qty-reserve-cascade" className="form-label">Quantity to Reserve *</label>
                  <input
                    id="qty-reserve-cascade"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ref-reserve-cascade" className="form-label">Reference ID *</label>
                  <input
                    id="ref-reserve-cascade"
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="e.g., ORDER-1001, PO-2024-03"
                    className="form-input"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedProductId && selectedCascadeBatchNo) {
                        // Reserve using cascade values
                        reserveInventory(selectedProductId, parseInt(quantity), referenceId, selectedCascadeBatchNo)
                          .then(() => {
                            showMessage("success", "Inventory reserved successfully!");
                            setQuantity("0");
                            setReferenceId("");
                            setSelectedCategory("");
                            setSelectedBrand("");
                            setSelectedProductName("");
                            setSelectedProductId(null);
                            setSelectedCascadeBatchNo("");
                            setCascadeBatches([]);
                            Promise.all([loadInventory(), loadReservedItems()]);
                          })
                          .catch((err: any) => {
                            const errorMsg = err?.response?.data?.message || err?.message || "Failed to reserve inventory";
                            showMessage("error", errorMsg);
                          });
                      }
                    }}
                    disabled={loading || parseInt(quantity) <= 0 || !referenceId.trim() || !selectedCascadeBatchNo || !selectedProductId}
                    className="btn btn-primary"
                  >
                    <span className="btn-icon">🔒</span>
                    <span className="btn-text">Reserve Now</span>
                  </button>
                </div>
              </form>
            </>
          )}

          {/* FALLBACK: OLD RESERVE METHOD FOR FIXED PRODUCT */}
          {!selectedProductId && (
            <>
              <h4 style={{ marginBottom: "1rem", fontSize: "1rem", fontWeight: 700, marginTop: "2rem" }}>📦 OR: Quick Reserve for Product ID {PRODUCT_ID}</h4>

              {batches.length > 0 ? (
                <div className="batches-info-container">
                  <h4 className="batches-title">📦 Available Batches ({batches.filter(b => b.availableQty > 0).length} with stock)</h4>
                  <div className="batches-grid">
                    {batches.map((batch, index) => (
                      <div
                        key={index}
                        className={`batch-card ${selectedBatchNo === batch.batchNo ? "selected" : ""} ${batch.availableQty === 0 ? "no-stock" : ""}`}
                        onClick={() => batch.availableQty > 0 && setSelectedBatchNo(batch.batchNo)}
                        title={batch.availableQty === 0 ? "No available stock in this batch" : `Click to select ${batch.batchNo}`}
                      >
                        <div className="batch-header">
                          <span className="batch-label">Batch:</span>
                          <span className="batch-value">{batch.batchNo}</span>
                        </div>
                        <div className="batch-details">
                          <div className="batch-detail-item">
                            <span className="detail-label">Available:</span>
                            <span className="detail-value" style={{ color: batch.availableQty === 0 ? '#ef5350' : '#22c55e' }}>
                              {batch.availableQty}
                            </span>
                          </div>
                          <div className="batch-detail-item">
                            <span className="detail-label">Expiry:</span>
                            <span className="detail-value">
                              {typeof batch.expiryDate === 'string' ? batch.expiryDate : new Date(batch.expiryDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-reserved-items">
                  <p className="empty-icon">📭</p>
                  <p className="empty-text">No batches found. Please add inventory first using the Adjust Inventory tab.</p>
                </div>
              )}

              <form className="form-grid">
                <div className="form-group">
                  <label htmlFor="batch-reserve" className="form-label">Select Batch *</label>
                  <select
                    id="batch-reserve"
                    value={selectedBatchNo}
                    onChange={(e) => setSelectedBatchNo(e.target.value)}
                    className="form-input"
                  >
                    <option value="">-- Choose a batch --</option>
                    {batches.map((batch, index) => (
                      <option key={index} value={batch.batchNo}>
                        {batch.batchNo} (Available: {batch.availableQty}, Expiry: {typeof batch.expiryDate === 'string' ? batch.expiryDate : new Date(batch.expiryDate).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="qty-reserve" className="form-label">Quantity to Reserve *</label>
                  <input
                    id="qty-reserve"
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="ref-reserve" className="form-label">Reference ID *</label>
                  <input
                    id="ref-reserve"
                    type="text"
                    value={referenceId}
                    onChange={(e) => setReferenceId(e.target.value)}
                    placeholder="e.g., ORDER-1001, PO-2024-03"
                    className="form-input"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    onClick={handleReserveInventory}
                    disabled={loading || parseInt(quantity) <= 0 || !referenceId.trim() || !selectedBatchNo}
                    className="btn btn-primary"
                  >
                    <span className="btn-icon">🔒</span>
                    <span className="btn-text">Reserve Now</span>
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="form-info">
            <div className="info-item">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">Reserved stock is held for orders and cannot be sold until released</span>
            </div>
          </div>
        </div>
      )}

      {/* RELEASE ACTION */}
      {selectedAction === "release" && (
        <div className="action-form release-form">
          <div className="form-header">
            <h3>🔓 Release Reserved Stock</h3>
            <p className="form-description">Select a reserved product and release it back to available stock</p>
          </div>

          {reservedItems.length > 0 ? (
            <form className="form-grid">
              <div className="form-group">
                <label htmlFor="release-item" className="form-label">Select Reserved Product *</label>
                <select
                  id="release-item"
                  value={selectedReleaseItem}
                  onChange={(e) => {
                    const item = reservedItems.find(i => i.referenceId === e.target.value);
                    if (item) {
                      setSelectedReleaseItem(e.target.value);
                      setQuantity(item.quantity.toString());
                    }
                  }}
                  className="form-input"
                >
                  <option value="">-- Select a reserved product --</option>
                  {reservedItems.map((item, index) => (
                    <option key={index} value={item.referenceId}>
                     {item.sku} | {item.quantity} | {item.productId}
                    </option>
                  ))}
                </select>
              </div>

              {selectedReleaseItem && (
                <>
                  <div className="form-group">
                    <label htmlFor="qty-release" className="form-label">Quantity to Release *</label>
                    <input
                      id="qty-release"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      className="form-input"
                      max={selectedReleaseItem ? reservedItems.find(i => i.referenceId === selectedReleaseItem)?.quantity : 0}
                    />
                  </div>
                </>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleReleaseInventory}
                  disabled={loading || parseInt(quantity) <= 0 || !selectedReleaseItem}
                  className="btn btn-warning"
                >
                  <span className="btn-icon">🔓</span>
                  <span className="btn-text">Release Now</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="empty-reserved-items">
              <p className="empty-icon">📭</p>
              <p className="empty-text">No reserved items found. All items are available.</p>
              <p className="empty-hint">
                💡 To release stock, first reserve it using the "Reserve Stock" tab with a reference ID.
              </p>
            </div>
          )}

          <div className="form-info">
            <div className="info-item">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">Released stock will be added back to available inventory and can be sold again</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminInventoryEdit;
