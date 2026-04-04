import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import './ShopkeeperDashboard.css';

const ShopkeeperDashboard = () => {
  const auth = useContext(AuthContext);
  const username = auth?.user?.username || 'Shopkeeper';
  
  const menuItems = [
    {
      title: 'Products',
      description: 'Browse and manage products',
      icon: '📦',
      link: '/shopkeeper/products',
      badge: 'View'
    },
    {
      title: 'Inventory',
      description: 'Check stock levels',
      icon: '📊',
      link: '/shopkeeper/inventory',
      badge: 'Check'
    },
    {
      title: 'Billing',
      description: 'Create and manage bills',
      icon: '💳',
      link: '/shopkeeper/billing',
      badge: 'Create'
    },
    {
      title: 'Customer Rewards',
      description: 'View customer wallet & rewards',
      icon: '🎁',
      link: '/shopkeeper/rewards',
      badge: 'Rewards'
    }
  ];

  return (
    <Container fluid className="shopkeeper-dashboard-container py-5">
      {/* Header Section */}
      <div className="text-white text-center mb-5">
        <h1 className="display-4 fw-bold mb-2">🏪 Shopkeeper Dashboard</h1>
        <p className="lead mb-0">Welcome, {username}! Manage your store operations efficiently</p>
      </div>

      {/* Menu Cards Grid */}
      <Row xs={1} md={2} lg={3} className="g-4 px-3 px-md-0">
        {menuItems.map((item, index) => (
          <Col key={index}>
            <Link to={item.link} className="text-decoration-none">
              <Card className="menu-card h-100 shadow-sm border-0 transition-all">
                <Card.Body className="d-flex flex-column p-4">
                  {/* Badge */}
                  <div className="mb-3">
                    <Badge bg="info" className="badge-lg">{item.badge}</Badge>
                  </div>

                  {/* Icon */}
                  <div className="menu-icon mb-3 text-center">{item.icon}</div>

                  {/* Title */}
                  <Card.Title className="menu-title text-center mb-3">{item.title}</Card.Title>

                  {/* Description */}
                  <Card.Text className="menu-description text-center text-muted mb-4">
                    {item.description}
                  </Card.Text>

                  {/* Button */}
                  <Button 
                    variant="primary" 
                    className="w-100 mt-auto fw-semibold"
                    size="lg"
                  >
                    Open <span className="ms-2">→</span>
                  </Button>
                </Card.Body>
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      {/* Footer Stats */}
      <Row className="mt-5 pt-4 border-top border-white border-opacity-10">
        <Col md={4} className="text-center mb-3 mb-md-0">
          <h5 className="text-white-50">Store Name</h5>
          <p className="text-white fs-5 fw-semibold">E-Kirana Store</p>
        </Col>
        <Col md={4} className="text-center mb-3 mb-md-0">
          <h5 className="text-white-50">Quick Access</h5>
          <p className="text-white fs-5 fw-semibold">4 Modules</p>
        </Col>
        <Col md={4} className="text-center">
          <h5 className="text-white-50">Last Updated</h5>
          <p className="text-white fs-5 fw-semibold">{new Date().toLocaleDateString()}</p>
        </Col>
      </Row>
    </Container>
  );
};

export default ShopkeeperDashboard;
