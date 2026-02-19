import React, { useEffect, useState } from "react";
import { Container, Card, Row, Col, Form, Button, Spinner } from "react-bootstrap";
import {
  getInventory,
  adjustInventory,
  reserveInventory,
  releaseInventory,
  type InventoryStatus
} from "../../services/inventoryService";

const AdminInventoryEdit: React.FC = () => {
  const PRODUCT_ID = 1; // later make dynamic

  const [inventory, setInventory] = useState<InventoryStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const [quantity, setQuantity] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const loadInventory = () => {
    setLoading(true);
    getInventory(PRODUCT_ID)
      .then(res => setInventory(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInventory();
  }, []);

  if (loading) {
    return <div className="text-center mt-5"><Spinner /></div>;
  }

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">📦 Inventory Management</h3>

      {/* Inventory Status */}
      {inventory && (
        <Row className="mb-4">
          <Col md={6}>
            <Card bg="success" text="white">
              <Card.Body>
                <Card.Title>Available Quantity</Card.Title>
                <h2>{inventory.availableQty}</h2>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card bg="warning">
              <Card.Body>
                <Card.Title>Reserved Quantity</Card.Title>
                <h2>{inventory.reservedQty}</h2>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Adjust Inventory */}
      <Card className="mb-3">
        <Card.Header>Adjust Inventory (IN / OUT)</Card.Header>
        <Card.Body>
          <Form className="row g-2">
            <Col md={3}>
              <Form.Control
                type="number"
                placeholder="Quantity"
                onChange={e => setQuantity(+e.target.value)}
              />
            </Col>
            <Col md={5}>
              <Form.Control
                placeholder="Remarks"
                onChange={e => setRemarks(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Button
                variant="success"
                onClick={() =>
                  adjustInventory(PRODUCT_ID, quantity, "IN", remarks).then(loadInventory)
                }
              >
                IN
              </Button>
            </Col>
            <Col md={2}>
              <Button
                variant="danger"
                onClick={() =>
                  adjustInventory(PRODUCT_ID, quantity, "OUT", remarks).then(loadInventory)
                }
              >
                OUT
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>

      {/* Reserve Inventory */}
      <Card className="mb-3">
        <Card.Header>Reserve Inventory</Card.Header>
        <Card.Body>
          <Form className="row g-2">
            <Col md={3}>
              <Form.Control
                type="number"
                placeholder="Quantity"
                onChange={e => setQuantity(+e.target.value)}
              />
            </Col>
            <Col md={5}>
              <Form.Control
                placeholder="Reference ID (ORDER-1001)"
                onChange={e => setReferenceId(e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Button
                variant="primary"
                onClick={() =>
                  reserveInventory(PRODUCT_ID, quantity, referenceId).then(loadInventory)
                }
              >
                Reserve
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>

      {/* Release Inventory */}
      <Card>
        <Card.Header>Release Inventory</Card.Header>
        <Card.Body>
          <Form className="row g-2">
            <Col md={3}>
              <Form.Control
                type="number"
                placeholder="Quantity"
                onChange={e => setQuantity(+e.target.value)}
              />
            </Col>
            <Col md={5}>
              <Form.Control
                placeholder="Reference ID (ORDER-1001)"
                onChange={e => setReferenceId(e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Button
                variant="secondary"
                onClick={() =>
                  releaseInventory(PRODUCT_ID, quantity, referenceId).then(loadInventory)
                }
              >
                Release
              </Button>
            </Col>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminInventoryEdit;
