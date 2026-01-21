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
  type Product
} from "../../services/productService";

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  /* 🔍 Filters */
  const [search, setSearch] = useState("");

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
       
      </Row>

      {/* 📦 Product Table (desktop) */}
      <div className="d-none d-md-block">
        <Table bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>SKU</th>
            <th>Name</th>
            <th>Price</th>
            <th>Barcode</th>
            <th>Status</th>
           
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

export default Products;
