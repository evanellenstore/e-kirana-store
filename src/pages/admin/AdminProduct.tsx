import React, { useEffect, useState } from "react";
import { Container, Table, Button, Modal, Form, Spinner } from "react-bootstrap";
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

  const emptyProduct: Product = {
    sku: "",
    name: "",
    description: "",
    category: "",
    brand: "",
    unit: "",
    price: 0,
    status: "ACTIVE",
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
    setFormData(product ? product : emptyProduct);
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

  if (loading)
    return <div className="text-center mt-5"><Spinner /></div>;

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">🛒 Shopkeeper – Product Management</h3>

      <Button className="mb-3" onClick={() => openModal()}>
        + Add Product
      </Button>

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
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.brand}</td>
              <td>{p.category}</td>
              <td>{p.unit}</td>
              <td>₹{p.price}</td>
              <td>{p.status}</td>
              <td>
                <Button size="sm" variant="warning" onClick={() => openModal(p)}>Edit</Button>{" "}
                <Button size="sm" variant="danger" onClick={() => removeProduct(p.id)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Modal */}
      <Modal show={show} onHide={() => setShow(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{editing ? "Edit Product" : "Add Product"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {Object.keys(emptyProduct).map((key) => (
            key !== "status" && (
              <Form.Group className="mb-2" key={key}>
                <Form.Control
                  placeholder={key.toUpperCase()}
                  value={(formData as any)[key]}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                />
              </Form.Group>
            )
          ))}
          <Form.Select
            value={formData.status}
            onChange={e => setFormData({ ...formData, status: e.target.value as any })}
          >
            <option>ACTIVE</option>
            <option>INACTIVE</option>
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
