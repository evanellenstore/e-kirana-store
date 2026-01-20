import React, { useEffect, useState } from "react";
import { Container, Table, Spinner, Card, Row, Col } from "react-bootstrap";
import {
  getAllProducts,
  type Product
} from "../../services/productService";

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProducts = () => {
    setLoading(true);
    getAllProducts()
      .then(res => setProducts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // no edit modal on shopkeeper list


  if (loading)
    return <div className="text-center mt-5"><Spinner /></div>;

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">🛒 Shopkeeper – Product Management</h3>

      {/* Desktop table */}
      <div className="d-none d-md-block">
        <Table bordered hover responsive>
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>SKU</th>
              <th>Name</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>₹{p.price}</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="d-block d-md-none">
        <Row xs={1} className="g-2">
          {products.map(p => (
            <Col key={p.id}>
              <Card>
                <Card.Header className="fw-semibold py-2">{p.name}</Card.Header>
                <Card.Body className="p-2">
                  <Row>
                    <Col xs={8}>
                      <div className="small text-muted">ID</div>
                      <div className="mb-2 text-truncate">{p.id}</div>

                      <div className="small text-muted">SKU</div>
                      <div className="mb-2 text-truncate">{p.sku}</div>
                    </Col>

                    <Col xs={4} className="text-end">
                      <div className="small text-muted">Price</div>
                      <div className="fw-bold">₹{p.price}</div>
                      <div className="mt-2"><span className={`badge bg-${p.status === 'ACTIVE' ? 'success' : 'secondary'}`}>{p.status}</span></div>
                    </Col>
                  </Row>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </Container>
  );
};

export default Products;
