import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const auth = useContext(AuthContext);
  const username = auth?.user?.username || 'Admin';

  const menuItems = [
    {
      title: 'Products',
      description: 'Manage product catalog',
      icon: '📦',
      link: '/admin/admin-products',
      badge: 'Manage',
      color: 'primary'
    },
    {
      title: 'Categories',
      description: 'Organize product categories',
      icon: '📂',
      link: '/admin/categories',
      badge: 'Organize',
      color: 'info'
    },
    {
      title: 'Brands',
      description: 'Manage brand data',
      icon: '🏷️',
      link: '/admin/brands',
      badge: 'Organize',
      color: 'success'
    },
    {
      title: 'Category-Brand Mapping',
      description: 'Map brands to categories',
      icon: '🔗',
      link: '/admin/category-brand-mapping',
      badge: 'Connect',
      color: 'secondary'
    },
    {
      title: 'Inventory',
      description: 'Track stock levels',
      icon: '📊',
      link: '/admin/admin-inventory',
      badge: 'Track',
      color: 'warning'
    },
    {
      title: 'Users',
      description: 'User roles & access',
      icon: '👥',
      link: '/admin/users',
      badge: 'Control',
      color: 'danger'
    },
    {
      title: 'Reports',
      description: 'Sales & analytics',
      icon: '📈',
      link: '/admin/reports',
      badge: 'Analyze',
      color: 'primary'
    },
    {
      title: 'Purchases',
      description: 'Manage purchase orders',
      icon: '🛒',
      link: '/admin/from-purchase',
      badge: 'Process',
      color: 'info'
    },
    {
      title: 'Rewards',
      description: 'Customer loyalty',
      icon: '💰',
      link: '/admin/rewards',
      badge: 'Rewards',
      color: 'success'
    }
  ];

  return (
    <Container fluid className="admin-dashboard-container py-4">

      {/* Header */}
      <div className="header-section mb-4">
        <Row className="align-items-center">
          <Col>
            <Badge bg="dark" className="mb-2 px-3 py-2">
              Admin Panel
            </Badge>
            <h2 className="header-title">
              Welcome, <span>{username}</span>
            </h2>
            <p className="header-subtitle">
              Manage your entire system from one place
            </p>
          </Col>

          <Col className="text-end d-none d-md-block">
            <p className="date-value">
              {new Date().toLocaleDateString('en-IN')}
            </p>
          </Col>
        </Row>
      </div>

      {/* Modules */}
      <div className="menu-section">
        <h5 className="section-title mb-3">Management</h5>

        <Row xs={1} md={2} lg={4} className="g-3">
          {menuItems.map((item, index) => (
            <Col key={index}>
              <Link to={item.link} className="text-decoration-none">
                <Card className="menu-card h-100">
                  <Card.Body className="p-3 d-flex flex-column">

                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="menu-icon">{item.icon}</span>
                      <Badge bg={item.color}>{item.badge}</Badge>
                    </div>

                    <Card.Title className="menu-title">
                      {item.title}
                    </Card.Title>

                    <Card.Text className="menu-description">
                      {item.description}
                    </Card.Text>

                    <Button variant="outline-dark" size="sm" className="mt-auto">
                      Open →
                    </Button>

                  </Card.Body>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>

      {/* Footer */}
      <Row className="footer-section mt-4">
        <Col md={12}>
          <div className="footer-content">
            <Row className="text-center">

              <Col md={4}>
                <div className="footer-item">
                  <div className="footer-icon">🏢</div>
                  <div className="footer-label">Platform</div>
                  <div className="footer-value">E-Commerce Pro</div>
                </div>
              </Col>

              <Col md={4}>
                <div className="footer-item">
                  <div className="footer-icon">👤</div>
                  <div className="footer-label">Role</div>
                  <div className="footer-value">Administrator</div>
                </div>
              </Col>

              <Col md={4}>
                <div className="footer-item">
                  <div className="footer-icon">⏰</div>
                  <div className="footer-label">Last Activity</div>
                  <div className="footer-value">
                    {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </Col>

            </Row>
          </div>
        </Col>
      </Row>

    </Container>
  );
};

export default AdminDashboard;