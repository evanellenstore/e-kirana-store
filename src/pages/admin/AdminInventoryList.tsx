import React, { useEffect, useState } from "react";
import { Modal } from "react-bootstrap";
import api from "../../services/api";
import "./AdminInventoryList.css";

/* =======================
   Interfaces
======================= */

interface Batch {
  batchNo: string;
  expiry: string;
  qty: number;
}

interface InventoryProduct {
  productId: string;
  productSku: string;
  productName: string;
  totalQty: number;
  batches: Batch[];
  barcode?: string;
}

/* =======================
   Constants
======================= */

const LOW_STOCK_LIMIT = 20;
const EXPIRY_WARNING_DAYS = 30;

/* =======================
   Component
======================= */

const InventoryList: React.FC = () => {
  const [data, setData] = useState<InventoryProduct[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  /* =======================
     Load Inventory
  ======================= */

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const res = await api.get("/inventory");
        const inventoryData = res.data as InventoryProduct[];
        
        // Fetch product details including barcode for each product
        const enrichedData = await Promise.all(
          inventoryData.map(async (product) => {
            try {
              const productRes = await api.get(`/products/${product.productId}`);
              return {
                ...product,
                barcode: productRes.data?.barcode || undefined
              };
            } catch (error) {
              console.error(`Failed to fetch product ${product.productId}`, error);
              return product;
            }
          })
        );
        
        setData(enrichedData);
        setFilteredData(enrichedData);
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, []);

  /* =======================
     Search Filter
  ======================= */

  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredData(
      data.filter(
        p =>
          p.productName.toLowerCase().includes(q) ||
          p.productSku.toLowerCase().includes(q)
      )
    );
  }, [search, data]);

  /* =======================
     Helpers
  ======================= */

  const getExpiryBadge = (expiry: string) => {
    const today = new Date();
    const exp = new Date(expiry);
    const diffDays =
      (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return <span className="badge badge-danger">Expired</span>;
    if (diffDays <= EXPIRY_WARNING_DAYS)
      return <span className="badge badge-warning">Near Expiry</span>;
    return <span className="badge badge-success">Valid</span>;
  };

  /* =======================
     Loading UI
  ======================= */

  if (loading) {
    return (
      <div className="inventory-loading">
        <div className="spinner">
          <div className="spinner-ring"></div>
        </div>
        <p className="loading-text">Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className="inventory-list-container">
      {/* Search Header */}
      <div className="inventory-search-header">
        <h2 className="search-title">📦 Inventory Overview</h2>
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search SKU / Product Name"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Product Cards */}
      {filteredData.length > 0 ? (
        <div className="inventory-products">
          {filteredData.map(product => (
            <div key={product.productId} className="product-card">
              {/* Product Header */}
              <div className="product-header">
                <div className="product-info">
                  <h3 className="product-name">{product.productName}</h3>
                  <div className="product-sku-section">
                    <div className="product-sku">SKU: <strong>{product.productSku}</strong></div>
                    {product.barcode && (
                      <div className="product-sku-barcode">
                        <img
                          src={`data:image/png;base64,${product.barcode}`}
                          alt="barcode"
                          className="product-sku-barcode-img"
                          onClick={() => { setBarcodePreview(product.barcode || null); setShowBarcodeModal(true); }}
                          title="Click to preview barcode"
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div className="product-qty-badge">
                  Total Qty: <strong>{product.totalQty}</strong>
                </div>
              </div>

              {/* Batch Table (Desktop) */}
              <div className="batches-desktop">
                <table className="batches-table">
                  <thead>
                    <tr>
                      <th>Batch No</th>
                      <th>Expiry Date</th>
                      <th className="text-center">Quantity</th>
                      <th className="text-center">Expiry Status</th>
                      <th className="text-center">Stock Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {product.batches.map(batch => {
                      const isLowStock = batch.qty <= LOW_STOCK_LIMIT;
                      return (
                        <tr key={batch.batchNo} className={isLowStock ? 'low-stock' : ''}>
                          <td className="batch-no">{batch.batchNo}</td>
                          <td className="expiry-date">
                            {new Date(batch.expiry).toLocaleDateString()}
                          </td>
                          <td className="qty-cell">{batch.qty}</td>
                          <td className="status-cell">
                            {getExpiryBadge(batch.expiry)}
                          </td>
                          <td className="stock-status">
                            {isLowStock ? (
                              <span className="badge badge-danger">Low Stock</span>
                            ) : (
                              <span className="badge badge-success">In Stock</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Batch Stacked View (Mobile) */}
              <div className="batches-mobile">
                {product.batches.map(batch => {
                  const isLowStock = batch.qty <= LOW_STOCK_LIMIT;
                  return (
                    <div key={batch.batchNo} className="batch-item">
                      <div className="batch-header">
                        <div className="batch-no">{batch.batchNo}</div>
                        <div className="batch-date">{new Date(batch.expiry).toLocaleDateString()}</div>
                      </div>
                      <div className="batch-body">
                        <div className="batch-qty">Qty: <strong>{batch.qty}</strong></div>
                        <div className="batch-badges">
                          <div>{getExpiryBadge(batch.expiry)}</div>
                          {isLowStock ? (
                            <span className="badge badge-danger">Low Stock</span>
                          ) : (
                            <span className="badge badge-success">In Stock</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3 className="empty-title">No Inventory Items Found</h3>
          <p className="empty-message">
            {search ? `No inventory matches "${search}"` : 'Start by adding your first inventory item'}
          </p>
        </div>
      )}

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
                <a href={`data:image/png;base64,${barcodePreview}`} download="barcode.png" className="btn btn-outline-primary btn-sm">📥 Download</a>
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

export default InventoryList;
