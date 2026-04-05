import React, { useEffect, useState } from "react";
import {
  getInventory,
  adjustInventory,
  reserveInventory,
  releaseInventory,
  getBatches,
  getReservedItems,
  type InventoryStatus,
  type BatchInfo,
  type ReservedItem
} from "../../services/inventoryService";
import "./AdminInventoryEdit.css";

const AdminInventoryEdit: React.FC = () => {
  const PRODUCT_ID = 1; // later make dynamic

  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [quantity, setQuantity] = useState<string>("0");
  const [remarks, setRemarks] = useState("");
  const [referenceId, setReferenceId] = useState("");
  const [selectedBatchNo, setSelectedBatchNo] = useState<string>("");
  const [selectedAction, setSelectedAction] = useState<"adjust" | "reserve" | "release">("adjust");
  
  // Available batches
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  
  // Reserved items
  const [reservedItems, setReservedItems] = useState<ReservedItem[]>([]);
  const [selectedReleaseItem, setSelectedReleaseItem] = useState<string>("");

  const loadInventory = () => {
    setLoading(true);
    getInventory(PRODUCT_ID)
      .then(res => setInventory(res.data))
      .catch(err => {
        setError("Failed to load inventory data");
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  const loadBatches = () => {
    console.log("Loading batches for product:", PRODUCT_ID);
    getBatches(PRODUCT_ID)
      .then(res => {
        console.log("Batches response:", res);
        const batchesData = res.data || [];
        console.log("Batches data:", batchesData);
        setBatches(batchesData);
        // Auto-select first batch if available
        if (batchesData && batchesData.length > 0) {
          console.log("Setting first batch:", batchesData[0].batchNo);
          setSelectedBatchNo(batchesData[0].batchNo);
        }
      })
      .catch(err => {
        console.error("Failed to load batches - Full error:", err);
        console.error("Error response:", err?.response?.data);
        console.error("Error message:", err?.message);
        setBatches([]);
      });
  };

  const loadReservedItems = () => {
    console.log("Loading reserved items for product:", PRODUCT_ID);
    getReservedItems(PRODUCT_ID)
      .then(res => {
        console.log("Reserved items response:", res);
        const itemsData = res.data || [];
        console.log("Reserved items data:", itemsData);
        setReservedItems(itemsData);
        // Auto-select first reserved item if available
        if (itemsData && itemsData.length > 0) {
          console.log("Setting first reserved item:", itemsData[0].referenceId);
          setSelectedReleaseItem(itemsData[0].referenceId);
        }
      })
      .catch(err => {
        console.error("Failed to load reserved items - Full error:", err);
        console.error("Error response:", err?.response?.data);
        console.error("Error message:", err?.message);
        setReservedItems([]);
      });
  };

  useEffect(() => {
    loadInventory();
    loadBatches();
    loadReservedItems();
  }, []);

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
      setSuccess(`Inventory ${type === "IN" ? "added" : "removed"} successfully`);
      setQuantity("0");
      setRemarks("");
      loadInventory();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err?.message || `Failed to ${type === "IN" ? "add" : "remove"} inventory`);
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
      console.log("Attempting to reserve:", { PRODUCT_ID, qty, referenceId, selectedBatchNo });
      const response = await reserveInventory(PRODUCT_ID, qty, referenceId, selectedBatchNo);
      console.log("Reserve response:", response);
      setSuccess("Inventory reserved successfully!");
      setQuantity("0");
      setReferenceId("");
      // Reload all data
      loadInventory();
      loadBatches();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Reserve error:", err);
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to reserve inventory";
      setError(errorMsg);
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
      console.log("Attempting to release:", { PRODUCT_ID, qty, referenceId: selectedReleaseItem });
      const response = await releaseInventory(PRODUCT_ID, qty, selectedReleaseItem);
      console.log("Release response:", response);
      setSuccess("Inventory released successfully!");
      setQuantity("0");
      // Reload all data
      loadInventory();
      loadBatches();
      loadReservedItems();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Release error:", err);
      const errorMsg = err?.response?.data?.message || err?.message || "Failed to release inventory";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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

      {/* Inventory Status Cards */}
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
          }}
        >
          <span className="tab-icon">🔓</span>
          <span className="tab-label">Release Stock</span>
        </button>
      </div>

      {/* Adjust Inventory Form */}
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

      {/* Reserve Inventory Form */}
      {selectedAction === "reserve" && (
        <div className="action-form reserve-form">
          <div className="form-header">
            <h3>🔒 Reserve Stock for Order</h3>
            <p className="form-description">Reserve inventory for pending orders or sales</p>
          </div>

          {/* Available Batches Info */}
          {batches.length > 0 && (
            <div className="batches-info-container">
              <h4 className="batches-title">📦 Available Batches ({batches.filter(b => b.availableQty > 0).length} with stock)</h4>
              <div className="batches-grid">
                {batches.map((batch, index) => (
                  <div
                    key={index}
                    className={`batch-card ${selectedBatchNo === batch.batchNo ? "selected" : ""} ${batch.availableQty === 0 ? "no-stock" : ""}`}
                    onClick={() => {
                      if (batch.availableQty > 0) {
                        setSelectedBatchNo(batch.batchNo);
                      }
                    }}
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
                        <span className="detail-value">{typeof batch.expiryDate === 'string' ? batch.expiryDate : new Date(batch.expiryDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {batches.length === 0 && (
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

          <div className="form-info">
            <div className="info-item">
              <span className="info-icon">ℹ️</span>
              <span className="info-text">Reserved stock is held for orders and cannot be sold until released</span>
            </div>
          </div>
        </div>
      )}

      {/* Release Inventory Form */}
      {/* REMOVED - Use dedicated Release Stock tab in main Admin Inventory page */}
    </div>
  );
};

export default AdminInventoryEdit;
