import { Container, Row, Col, Card } from "react-bootstrap";
import { Link } from "react-router-dom";
import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { AuthContext } from "../../auth/AuthContext";

const CustomerDashboard = () => {
  const auth = useContext(AuthContext);
  const { t } = useTranslation();
  const username = auth?.user?.username || "Customer";

  return (
    <Container className="mt-5 mb-5">
      <div className="mb-5">
        <h1 className="mb-2">{t('customer.welcome')}, {username}! 👋</h1>
        <p className="text-muted">{t('customer.title')}</p>
      </div>

      <Row className="g-4">
        {/* Products Card */}
        <Col md={6} lg={4}>
          <Card className="h-100 shadow-sm hover-card">
            <Card.Body>
              <div className="text-center">
                <h2>🛍️</h2>
                <Card.Title>{t('customer.browse')}</Card.Title>
                <Card.Text className="text-muted small">
                  {t('navigation.shop')}
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/products" className="btn btn-primary btn-sm w-100">
                {t('common.edit')}
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
                <Card.Title>{t('customer.cart')}</Card.Title>
                <Card.Text className="text-muted small">
                  {t('cart.empty')}
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/cart" className="btn btn-primary btn-sm w-100">
                {t('cart.checkout')}
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
                <Card.Title>{t('customer.orders')}</Card.Title>
                <Card.Text className="text-muted small">
                  {t('order.orderId')}
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/orders" className="btn btn-primary btn-sm w-100">
                {t('navigation.myOrders')}
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
                  {t('order.total')}
                </Card.Text>
              </div>
            </Card.Body>
            <Card.Footer className="bg-transparent border-top">
              <Link to="/customer/rewards" className="btn btn-success btn-sm w-100">
                {t('navigation.myOrders')}
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
