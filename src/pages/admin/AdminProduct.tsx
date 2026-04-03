import React, { useEffect, useMemo, useState } from "react";
import {
  Container,
  Table,
  Button,
  Modal,
  Form,
  Spinner,
  Row,
  Col,
  Card
} from "react-bootstrap";
import AdminHeader from "../../components/AdminHeader";
import api from "../../services/api";
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getActiveBrands,
  type Product,
  type Brand
} from "../../services/productService";

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
    
    // Load brands for the selected category
    if (productToEdit.category) {
      loadBrandsByCategory();
    } else {
      setBrands([]);
    }
    
    setShow(true);
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
      <div className="text-center mt-5">
        <Spinner />
      </div>
    );
  }

  return (
    <Container className="mt-4">
      <AdminHeader 
        title="Product Management" 
        description="Create, edit, and manage your products"
      />

      {/* 🔍 Filters - responsive */}
      <Row className="mb-3 g-2">
        <Col xs={12} md={4}>
          <Form.Control
            placeholder="Search by SKU or Name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Col>

  {/* filters removed: Brand / Category / Unit */}

        <Col xs={12} md={2} className="text-md-end">
          <Button
            variant="success"
            className="w-100 w-md-auto d-flex align-items-center justify-content-center gap-2 py-2 shadow-sm rounded-3"
            onClick={() => openModal()}
          >
            <span
              className="bg-white text-success rounded-circle d-inline-flex align-items-center justify-content-center"
              style={{ width: 28, height: 28, fontSize: 16 }}
            >
              +
            </span>
            <span className="fw-semibold">Add Product</span>
          </Button>
        </Col>
      </Row>

      {/* 📦 Product Table (desktop) */}
      <div className="d-none d-md-block">
        <Table bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>SKU</th>
            <th>Name</th>
            {/* Brand / Category / Unit removed */}
            <th>Price</th>
            <th>Discount</th>
            <th>Barcode</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {filteredProducts.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td className="fw-semibold">{p.sku}</td>
              <td>{p.name}</td>
              {/* Brand / Category / Unit removed */}
              <td>₹{p.price}</td>
              <td>₹{p.discountAmount || 0}</td>
              <td className="text-center">
                {p.barcode ? (
                  <img
                    src={`data:image/png;base64,${p.barcode}`}
                    alt="barcode"
                    style={{ width: 220, height: 'auto', cursor: 'pointer' }}
                    onClick={() => { setBarcodePreview(p.barcode || null); setShowBarcodeModal(true); }}
                  />
                ) : (
                  <small className="text-muted">—</small>
                )}
              </td>
              <td>
                <span className={`badge bg-${p.status === "ACTIVE" ? "success" : "secondary"}`}>
                  {p.status}
                </span>
              </td>
              <td>
                <Button
                  size="sm"
                  variant="warning"
                  onClick={() => openModal(p)}
                >
                  Edit
                </Button>{" "}
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => removeProduct(p.id)}
                >
                  Delete
                </Button>
              </td>
            </tr>
          ))}

          {filteredProducts.length === 0 && (
            <tr>
              <td colSpan={9} className="text-center text-muted py-4">
                No products found
              </td>
            </tr>
          )}
        </tbody>
        </Table>
      </div>

      {/* 📱 Product list (mobile) */}
      <div className="d-block d-md-none">
        {filteredProducts.map(p => (
          <Card className="mb-3" key={p.id}>
            <Card.Header className="fw-semibold py-2">{p.name}</Card.Header>
            <Card.Body className="p-2">
              {p.barcode && (
                <div className="text-center mb-2">
                  <img
                    src={`data:image/png;base64,${p.barcode}`}
                    alt="barcode"
                    style={{ maxWidth: 260, cursor: 'pointer' }}
                    onClick={() => { setBarcodePreview(p.barcode || null); setShowBarcodeModal(true); }}
                  />
                </div>
              )}
              <Row>
                <Col xs={6} className="pe-2">
                  <div className="small text-muted">ID</div>
                  <div className="mb-2 text-truncate">{p.id}</div>

                  <div className="small text-muted">SKU</div>
                  <div className="mb-2 text-truncate">{p.sku}</div>

                  <div className="small text-muted">Brand</div>
                  <div className="mb-2 text-truncate">{p.brandName}</div>
                </Col>

                <Col xs={6} className="ps-2">
                  <div className="small text-muted">Category</div>
                  <div className="mb-2 text-truncate">{p.category}</div>

                  <div className="small text-muted">Unit</div>
                  <div className="mb-2 text-truncate">{p.unit}</div>

                  <div className="small text-muted">Status</div>
                  <div className="mb-2"><span className={`badge bg-${p.status === "ACTIVE" ? "success" : "secondary"}`}>{p.status}</span></div>
                </Col>
              </Row>

              <Row className="align-items-center mb-2">
                <Col xs={6}>
                  <div className="small text-muted">Price</div>
                  <div className="fw-bold">₹{p.price}</div>
                </Col>
                <Col xs={6}>
                  <div className="small text-muted">Discount</div>
                  <div className="fw-bold">₹{p.discountAmount || 0}</div>
                </Col>
              </Row>

              <Row className="align-items-center">
                <Col xs={6} className="text-start">
                </Col>
                <Col xs={6} className="text-end">
                  <Button size="sm" variant="warning" className="me-1" onClick={() => openModal(p)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => removeProduct(p.id)}>Delete</Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        ))}
      </div>

  {/* 🧾 Modal */}
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Product" : "Add Product"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
         

          {/* Category - Dynamic Dropdown */}
          <Form.Group className="mb-2">
            <Form.Label>Category *</Form.Label>
            <Form.Select
              value={formData.category}
              onChange={e => {
                const selectedCategory = e.target.value;
                console.log("Category selected:", selectedCategory);
                setFormData({ ...formData, category: selectedCategory });
                // Clear brand when category changes
                setFormData(prev => ({ ...prev, category: selectedCategory, brandId: undefined, brandName: undefined }));
              }}
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

          {/* Brand - Dynamic Dropdown (shows with dummy value, then loads real values) */}
          <Form.Group className="mb-2">
            <Form.Label>Brand *</Form.Label>
            {!formData.category ? (
              <Form.Select disabled>
                <option value="">Select category first</option>
              </Form.Select>
            ) : loadingBrands ? (
              <div className="alert alert-info mb-0" role="alert">
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
                }
                }
              >
                <option value="">Select a brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.brand}
                  </option>
                ))}
              </Form.Select>
            ) : (
              <div className="alert alert-warning mb-0" role="alert">
                No brands available
              </div>
            )}
          </Form.Group>

           {/* Product Name */}
          <Form.Group className="mb-2">
            <Form.Label>Product Name *</Form.Label>
            <Form.Control
              placeholder="Enter product name"
              value={formData.name}
              onChange={e =>
                setFormData({ ...formData, name: e.target.value })
              }
            />
          </Form.Group>

          {/* Unit */}
          <Form.Group className="mb-2">
            <Form.Label>Unit *</Form.Label>
            <Form.Control
              placeholder="e.g., kg, liters, pieces"
              value={formData.unit}
              onChange={e =>
                setFormData({ ...formData, unit: e.target.value })
              }
            />
          </Form.Group>

          {/* Price */}
          <Form.Group className="mb-2">
            <Form.Label>Price *</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter price"
              value={formData.price}
              onChange={e =>
                setFormData({ ...formData, price: parseFloat(e.target.value) })
              }
            />
          </Form.Group>

          {/* Discount Amount */}
          <Form.Group className="mb-2">
            <Form.Label>Discount (₹)</Form.Label>
            <Form.Control
              type="number"
              placeholder="Enter discount amount in rupees"
              min="0"
              step="0.01"
              value={formData.discountAmount || 0}
              onChange={e =>
                setFormData({ ...formData, discountAmount: parseFloat(e.target.value) || 0 })
              }
            />
          </Form.Group>

          {/* Description */}
          <Form.Group className="mb-2">
            <Form.Label>Description</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Enter product description"
              value={formData.description}
              onChange={e =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </Form.Group>

          {/* Status */}
          <Form.Group className="mb-2">
            <Form.Label>Status</Form.Label>
            <Form.Select
              value={formData.status}
              onChange={e =>
                setFormData({ ...formData, status: e.target.value as any })
              }
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button onClick={saveProduct}>Save</Button>
        </Modal.Footer>
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
    </Container>
  );
};

export default AdminProducts;
