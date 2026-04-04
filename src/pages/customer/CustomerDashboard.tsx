import { Container, Row, Col, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../auth/AuthContext";

const CustomerDashboard = () => {
  const auth = useContext(AuthContext);
  const username = auth?.user?.username || "Customer";

  return (
    <Container className="mt-5 mb-5">
      <div className="mb-5">
        <h1 className="mb-2">Welcome, {username}! 👋</h1>
        <p className="text-muted">Your one-stop shop for all shopping needs</p>
      </div>

      <Row className="g-4">
        {/* Products Card */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm hover-card">
            <Card.Body>
              <div className="text-center">
                <h2>🛍️</h2>
                <Card.Title>Browse Products</Card.Title>
                <Card.Text className="text-muted small">
                  Explore our wide range of products
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/products" className="btn btn-primary btn-sm w-100">
                Shop Now
              </Link>
            </Card.Footer>
          </Card>
        </Col>

        {/* Cart Card */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm hover-card">
            <Card.Body>
              <div className="text-center">
                <h2>🛒</h2>
                <Card.Title>Your Cart</Card.Title>
                <Card.Text className="text-muted small">
                  View and manage your shopping cart
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/cart" className="btn btn-primary btn-sm w-100">
                View Cart
              </Link>
            </Card.Footer>
          </Card>
        </Col>

        {/* Orders Card */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm hover-card">
            <Card.Body>
              <div className="text-center">
                <h2>📦</h2>
                <Card.Title>Your Orders</Card.Title>
                <Card.Text className="text-muted small">
                  Track your order history
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/orders" className="btn btn-primary btn-sm w-100">
                View Orders
              </Link>
            </Card.Footer>
          </Card>
        </Col>

        {/* Rewards Card */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm hover-card border-success">
            <Card.Body>
              <div className="text-center">
                <h2>💰</h2>
                <Card.Title>Rewards & Wallet</Card.Title>
                <Card.Text className="text-muted small">
                  Check your wallet balance and rewards
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/rewards" className="btn btn-success btn-sm w-100">
                View Rewards
              </Link>
            </Card.Footer>
          </Card>
        </Col>
      </Row>

      {/* Additional Info */}
      <Row className="mt-5">
        <Col md={8} className="mx-auto">
          <Card className="bg-light border-0">
            <Card.Body>
              <h5 className="mb-3">✨ Why Shop With Us?</h5>
              <div className="row">
                <div className="col-md-6">
                  <p className="small">
                    <strong>💳 Easy Payments:</strong> Multiple payment options available
                  </p>
                  <p className="small">
                    <strong>📦 Fast Delivery:</strong> Quick and reliable shipping
                  </p>
                </div>
                <div className="col-md-6">
                  <p className="small">
                    <strong>🎁 Earn Rewards:</strong> Every purchase earns you points
                  </p>
                  <p className="small">
                    <strong>💰 Great Discounts:</strong> Regular offers and promotions
                  </p>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default CustomerDashboard;
