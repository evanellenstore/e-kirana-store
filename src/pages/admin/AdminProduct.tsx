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
import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  type Product
} from "../../services/productService";

const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  /* 🔍 Filters */
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const emptyProduct: Product = {
    sku: "",
    name: "",
    description: "",
    category: "",
    brand: "",
    unit: "",
    price: 0,
    status: "ACTIVE"
  };

  const [formData, setFormData] = useState<Product>(emptyProduct);

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

  /* 🧠 Unique brands & categories for filters */
  const brands = useMemo(
    () => [...new Set(products.map(p => p.brand).filter(Boolean))],
    [products]
  );

  const categories = useMemo(
    () => [...new Set(products.map(p => p.category).filter(Boolean))],
    [products]
  );

  /* 🔎 Filter logic */
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());

      const matchBrand = brandFilter ? p.brand === brandFilter : true;
      const matchCategory = categoryFilter ? p.category === categoryFilter : true;

      return matchSearch && matchBrand && matchCategory;
    });
  }, [products, search, brandFilter, categoryFilter]);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner />
      </div>
    );
  }

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">🛒 Product Management</h3>

      {/* 🔍 Filters - responsive */}
      <Row className="mb-3 g-2">
        <Col xs={12} md={4}>
          <Form.Control
            placeholder="Search by SKU or Name"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </Col>

        <Col xs={6} md={3}>
          <Form.Select
            value={brandFilter}
            onChange={e => setBrandFilter(e.target.value)}
          >
            <option value="">All Brands</option>
            {brands.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </Form.Select>
        </Col>

        <Col xs={6} md={3}>
          <Form.Select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Form.Select>
        </Col>

        <Col xs={12} md={2} className="text-md-end">
          <Button className="w-100 w-md-auto" onClick={() => openModal()}>+ Add Product</Button>
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
            <th>Brand</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Price</th>
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
              <td>{p.brand}</td>
              <td>{p.category}</td>
              <td>{p.unit}</td>
              <td>₹{p.price}</td>
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
              <Row>
                <Col xs={6} className="pe-2">
                  <div className="small text-muted">ID</div>
                  <div className="mb-2 text-truncate">{p.id}</div>

                  <div className="small text-muted">SKU</div>
                  <div className="mb-2 text-truncate">{p.sku}</div>

                  <div className="small text-muted">Brand</div>
                  <div className="mb-2 text-truncate">{p.brand}</div>
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

              <Row className="align-items-center">
                <Col xs={6} className="fw-bold">₹{p.price}</Col>
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

        <Modal.Footer>
          <Button onClick={saveProduct}>Save</Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminProducts;
