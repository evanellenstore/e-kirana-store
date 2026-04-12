import React, { useEffect, useState } from "react";
import { Container, Table, Spinner, Card, Row, Col, Button } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import AdminHeader from "../../components/AdminHeader";
import { getReport, type ReportResponse } from "../../services/reportingService";

const ReportPage: React.FC = () => {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    getReport()
      .then((res) => setReport(res.data))
      .catch((err) => {
        console.error("Error fetching report:", err);
        // Handle 401 (token expired) separately
        if (err.response?.status === 401) {
          setError("Your session has expired. Please login again.");
          localStorage.removeItem("user");
          setTimeout(() => {
            window.location.href = "/login?expired=true";
          }, 2000);
        } else {
          setError(err.message || "Failed to load report");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <div className="text-center mt-5"><Spinner animation="border" /> Loading report...</div>;

  if (error)
    return <div className="alert alert-danger mt-5 text-center"><h5>Session Expired</h5><p>{error}</p></div>;

  if (!report)
    return <div className="alert alert-danger mt-5 text-center">No report data available</div>;

  return (
    <Container className="mt-4">
      <AdminHeader 
        title="Reports & Analytics" 
        description="View inventory and sales reports"
      />

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="mb-0">📊 Inventory & Sales Report</h2>
        <Button 
          variant="primary" 
          onClick={() => navigate('/admin/detailed-reports')}
        >
          📈 View Detailed Report with Graphs
        </Button>
      </div>

      {/* Report Navigation Cards */}
      <Row className="mb-5">
        <Col md={6} lg={3} className="mb-3">
          <Card 
            className="h-100 cursor-pointer" 
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/admin/sales-report')}
          >
            <Card.Body className="text-center">
              <div className="fs-1 mb-3">📈</div>
              <Card.Title>Sales Report</Card.Title>
              <Card.Text className="text-muted small">
                Track sales performance and trends
              </Card.Text>
              <Button variant="outline-primary" size="sm">View Details</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3} className="mb-3">
          <Card 
            className="h-100 cursor-pointer"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/admin/inventory-report')}
          >
            <Card.Body className="text-center">
              <div className="fs-1 mb-3">📦</div>
              <Card.Title>Inventory Report</Card.Title>
              <Card.Text className="text-muted small">
                Monitor stock levels and status
              </Card.Text>
              <Button variant="outline-primary" size="sm">View Details</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3} className="mb-3">
          <Card 
            className="h-100 cursor-pointer"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/admin/product-report')}
          >
            <Card.Body className="text-center">
              <div className="fs-1 mb-3">🏷️</div>
              <Card.Title>Product Report</Card.Title>
              <Card.Text className="text-muted small">
                Analyze product performance
              </Card.Text>
              <Button variant="outline-primary" size="sm">View Details</Button>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6} lg={3} className="mb-3">
          <Card 
            className="h-100 cursor-pointer"
            style={{ cursor: 'pointer' }}
            onClick={() => navigate('/admin/billing-report')}
          >
            <Card.Body className="text-center">
              <div className="fs-1 mb-3">💳</div>
              <Card.Title>Billing Report</Card.Title>
              <Card.Text className="text-muted small">
                Track revenue and tax metrics
              </Card.Text>
              <Button variant="outline-primary" size="sm">View Details</Button>
            </Card.Body>
          </Card>
        </Col>
      </Row>

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
