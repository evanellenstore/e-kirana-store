import React, { useEffect, useState } from "react";
import { Container, Table, Button, Form, Card, Spinner, Row, Col } from "react-bootstrap";
import {
  createBilling,
  getAllBillings,
  getBillingByPurchaseId,
  type Billing
} from "../../services/billingService";

const BillingPage: React.FC = () => {
  const [billings, setBillings] = useState<Billing[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseId, setPurchaseId] = useState<number>(0);

  const loadBillings = () => {
    setLoading(true);
    getAllBillings()
      .then(res => setBillings(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBillings();
  }, []);

  const handleCreateBill = () => {
    if (!purchaseId) return alert("Enter purchase ID");
    createBilling(purchaseId).then(() => {
      setPurchaseId(0);
      loadBillings();
    });
  };

  const searchByPurchaseId = () => {
    if (!purchaseId) return;
    setLoading(true);
    getBillingByPurchaseId(purchaseId)
      .then(res => setBillings(res.data))
      .finally(() => setLoading(false));
  };

  if (loading)
    return <div className="text-center mt-5"><Spinner /></div>;

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">🧾 Billing Management</h3>

      {/* Create Bill */}
      <Card className="mb-4">
        <Card.Header>Create Bill</Card.Header>
        <Card.Body>
          <Row className="g-2">
            <Col md={4}>
              <Form.Control
                type="number"
                placeholder="Purchase ID"
                value={purchaseId || ""}
                onChange={e => setPurchaseId(+e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Button onClick={handleCreateBill}>Generate Bill</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Search */}
      <Card className="mb-3">
        <Card.Header>Search Bills</Card.Header>
        <Card.Body>
          <Row className="g-2">
            <Col md={4}>
              <Form.Control
                type="number"
                placeholder="Purchase ID"
                onChange={e => setPurchaseId(+e.target.value)}
              />
            </Col>
            <Col md={4}>
              <Button variant="secondary" onClick={searchByPurchaseId}>
                Search by Purchase ID
              </Button>
            </Col>
            <Col md={4}>
              <Button variant="outline-dark" onClick={loadBillings}>
                Load All Bills
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Billing Table */}
      <Table bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th>Bill ID</th>
            <th>Purchase ID</th>
            <th>Sub Total</th>
            <th>Tax</th>
            <th>Total</th>
            <th>Billed At</th>
          </tr>
        </thead>
        <tbody>
          {billings.map(b => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.purchaseId}</td>
              <td>₹{b.subTotal}</td>
              <td>₹{b.taxAmount.toFixed(2)}</td>
              <td><strong>₹{b.totalAmount}</strong></td>
              <td>{new Date(b.billedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
};

export default BillingPage;
