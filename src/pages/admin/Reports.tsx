import React, { useEffect, useState } from "react";
import { Container, Table, Spinner, Card, Row, Col } from "react-bootstrap";
import { getReport, type ReportResponse } from "../../services/reportingService";

const ReportPage: React.FC = () => {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReport()
      .then((res) => setReport(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-center mt-5"><Spinner animation="border" /> Loading report...</div>;

  if (!report)
    return <div className="alert alert-danger mt-5 text-center">No report data available</div>;

  return (
    <Container className="mt-4">
      <h2 className="mb-4 text-center">📊 Inventory & Sales Report</h2>

      {/* Totals */}
      <Row className="mb-4">
        <Col md={6}>
          <Card className="text-white bg-primary mb-3">
            <Card.Body>
              <Card.Title>Total Revenue</Card.Title>
              <Card.Text>₹{report.totalRevenue.toFixed(2)}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="text-white bg-success mb-3">
            <Card.Body>
              <Card.Title>Total Tax</Card.Title>
              <Card.Text>₹{report.totalTax.toFixed(2)}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Inventory Status Table */}
      <h4 className="mb-3">Inventory Status</h4>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Available Quantity</th>
            <th>Reserved Quantity</th>
          </tr>
        </thead>
        <tbody>
          {report.inventoryStatus.map((item) => (
            <tr key={item.productId}>
              <td>{item.productId}</td>
              <td>{item.availableQty}</td>
              <td>{item.reservedQty}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Product Reports Table */}
      <h4 className="mb-3 mt-4">Product Reports</h4>
      <Table striped bordered hover responsive>
        <thead>
          <tr>
            <th>Product ID</th>
            <th>Total Purchased</th>
            <th>Total Revenue</th>
          </tr>
        </thead>
        <tbody>
          {report.productReports.map((product, index) => (
            <tr key={index}>
              <td>{product.productId}</td>
              <td>{product.totalPurchased ?? "0"}</td>
              <td>${product.totalRevenue?.toFixed(2) ?? "0.00"}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Container>
  );
};

export default ReportPage;
