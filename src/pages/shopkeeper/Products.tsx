import React, { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Form,
  Modal
} from "react-bootstrap";
import ShopkeeperHeader from "../../components/ShopkeeperHeader";
import {
  getAllProducts,
  type Product
} from "../../services/productService";
import "./Products.css";

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  /* 🔍 Filters & Pagination */
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  const emptyProduct: Product = {
    sku: "",
    name: "",
    description: "",
    category: "",
    brandName: "",
    unit: "",
    price: 0,
    status: "ACTIVE"
  };

  const [formData, setFormData] = useState<Product>(emptyProduct);
  const [barcodePreview, setBarcodePreview] = useState<string | null>(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);

  const loadProducts = () => {
    setLoading(true);
    getAllProducts()
      .then(res => setProducts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openModal = (product?: Product) => {
    setEditing(product || null);
    setFormData(product ?? emptyProduct);
    setShow(true);
  };

  /* 🔎 Filter logic */
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());

      return matchSearch;
    });
  }, [products, search]);

  /* 📄 Pagination logic */
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  if (loading) {
    return (
      <div className="products-loading-container">
        <div className="products-spinner"></div>
        <p>Loading products...</p>
      </div>
    );
  }

  return (
    <div className="products-page-container">
      <div className="products-content">
        <ShopkeeperHeader 
          title="Product Management"
          description="Browse and manage all products in your store"
        />

        {/* Search Card */}
        <div className="products-search-card">
          <div className="products-search-header">
            <h3 className="products-search-title">🔍 Search Products</h3>
            <div className="products-count-badge">
              Showing {paginatedProducts.length} of {filteredProducts.length}
            </div>
          </div>
          <div className="products-search-body">
            <div className="products-search-input-group">
              <Form.Control
                placeholder="Search by SKU or Product Name"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="products-input"
              />
              <span className="products-search-icon">🔎</span>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="products-grid">
          {paginatedProducts.map(p => (
            <div key={p.id} className="product-card">
              <div className="product-card-header">
                <div className="product-card-title-section">
                  <h4 className="product-name">{p.name}</h4>
                  <div className="product-sku">SKU: {p.sku}</div>
                </div>
                <Badge 
                  className={`product-status-badge ${p.status === "ACTIVE" ? "badge-active" : "badge-inactive"}`}
                >
                  {p.status}
                </Badge>
              </div>

              <div className="product-card-body">
                <div className="product-info-grid">
                  <div className="product-info-item">
                    <span className="info-label">Category</span>
                    <span className="info-value">{p.category || "N/A"}</span>
                  </div>
                  <div className="product-info-item">
                    <span className="info-label">Brand</span>
                    <span className="info-value">{p.brandName || "N/A"}</span>
                  </div>
                  <div className="product-info-item">
                    <span className="info-label">Unit</span>
                    <span className="info-value">{p.unit || "N/A"}</span>
                  </div>
                  <div className="product-info-item">
                    <span className="info-label">Price</span>
                    <span className="info-value price">₹{p.price}</span>
                  </div>
                </div>

                {p.discountAmount ? (
                  <div className="product-discount-section">
                    <span className="discount-label">Discount</span>
                    <span className="discount-value">₹{p.discountAmount}</span>
                  </div>
                ) : null}

                {p.barcode && (
                  <div className="product-barcode-section">
                    <img
                      src={`data:image/png;base64,${p.barcode}`}
                      alt="barcode"
                      className="product-barcode-img"
                      onClick={() => { setBarcodePreview(p.barcode || null); setShowBarcodeModal(true); }}
                    />
                  </div>
                )}

                {p.description && (
                  <div className="product-description">
                    <p>{p.description}</p>
                  </div>
                )}
              </div>

              <div className="product-card-footer">
                <button 
                  className="product-btn product-btn-edit"
                  onClick={() => openModal(p)}
                >
                  ✏️ Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredProducts.length === 0 && (
          <div className="products-empty-state">
            <div className="products-empty-icon">📭</div>
            <p className="products-empty-text">No products found</p>
          </div>
        )}

        {/* Pagination */}
        {filteredProducts.length > itemsPerPage && (
          <div className="products-pagination">
            <button
              className="products-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            
            <div className="products-pagination-info">
              <span className="pagination-page-number">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <span className="pagination-total">
                Total: <strong>{filteredProducts.length}</strong> products
              </span>
            </div>
            
            <button
              className="products-pagination-btn"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Product" : "Add Product"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {Object.keys(emptyProduct).map(key =>
            key !== "status" ? (
              <Form.Group className="mb-2" key={key}>
                <Form.Control
                  placeholder={key.toUpperCase()}
                  value={(formData as any)[key]}
                  onChange={e =>
                    setFormData({ ...formData, [key]: e.target.value })
                  }
                />
              </Form.Group>
            ) : null
          )}

          <Form.Select
            value={formData.status}
            onChange={e =>
              setFormData({ ...formData, status: e.target.value as any })
            }
          >
            <option value="ACTIVE">ACTIVE</option>
            <option value="INACTIVE">INACTIVE</option>
          </Form.Select>
        </Modal.Body>
      </Modal>

      {/* Barcode preview modal */}
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

export default Products;
