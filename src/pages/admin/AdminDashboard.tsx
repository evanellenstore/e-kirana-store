import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const menuItems = [
    {
      title: 'Products',
      description: 'Manage product catalog',
      icon: '📦',
      link: '/admin/admin-products',
      badge: 'Manage'
    },
    {
      title: 'Categories',
      description: 'Manage product categories',
      icon: '📂',
      link: '/admin/categories',
      badge: 'Organize'
    },
    {
      title: 'Inventory',
      description: 'Manage inventory stock',
      icon: '📊',
      link: '/admin/admin-inventory',
      badge: 'Track'
    },
    {
      title: 'Users',
      description: 'Manage system users',
      icon: '👥',
      link: '/admin/users',
      badge: 'Control'
    },
    {
      title: 'Reports',
      description: 'View sales and analytics',
      icon: '📈',
      link: '/admin/reports',
      badge: 'Analyze'
    },
    {
      title: 'From Purchase',
      description: 'Process purchases',
      icon: '🛒',
      link: '/admin/from-purchase',
      badge: 'Process'
    }
  ];

  return (
    <Container fluid className="admin-dashboard-container py-5">
      {/* Header Section */}
      <div className="text-white text-center mb-5">
        <h1 className="display-4 fw-bold mb-2">⚙️ Admin Dashboard</h1>
        <p className="lead mb-0">Complete control of your e-commerce platform</p>
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
                    <Badge bg="warning" className="badge-lg text-dark">{item.badge}</Badge>
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
        <Col md={3} className="text-center mb-3 mb-md-0">
          <h5 className="text-white-50">Platform</h5>
          <p className="text-white fs-5 fw-semibold">E-Commerce</p>
        </Col>
        <Col md={3} className="text-center mb-3 mb-md-0">
          <h5 className="text-white-50">Modules</h5>
          <p className="text-white fs-5 fw-semibold">6 Available</p>
        </Col>
        <Col md={3} className="text-center mb-3 mb-md-0">
          <h5 className="text-white-50">Admin Level</h5>
          <p className="text-white fs-5 fw-semibold">Full Access</p>
        </Col>
        <Col md={3} className="text-center">
          <h5 className="text-white-50">Last Updated</h5>
          <p className="text-white fs-5 fw-semibold">{new Date().toLocaleDateString()}</p>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminDashboard;
