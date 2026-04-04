import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import './ShopkeeperDashboard.css';

const ShopkeeperDashboard = () => {
  const auth = useContext(AuthContext);
  const username = auth?.user?.username || 'Shopkeeper';
  
  // Quick action buttons
  const quickActions = [
    { label: 'Create Bill', icon: '📄', color: 'primary', link: '/shopkeeper/billing' },
    { label: 'Check Inventory', icon: '📦', color: 'info', link: '/shopkeeper/inventory' },
    { label: 'View Analytics', icon: '📈', color: 'warning', link: '/shopkeeper/products' },
    { label: 'Rewards Info', icon: '🎁', color: 'success', link: '/shopkeeper/rewards' }
  ];
  
  const menuItems = [
    {
      title: 'Products',
      description: 'Browse, search and manage your product catalog',
      icon: '📦',
      link: '/shopkeeper/products',
      badge: 'View',
      color: 'primary',
      stats: 'Manage catalog'
    },
    {
      title: 'Inventory',
      description: 'Track stock levels, low stock alerts and reorder',
      icon: '📊',
      link: '/shopkeeper/inventory',
      badge: 'Check',
      color: 'info',
      stats: 'Stock control'
    },
    {
      title: 'Billing',
      description: 'Create invoices, manage transactions and payments',
      icon: '💳',
      link: '/shopkeeper/billing',
      badge: 'Create',
      color: 'success',
      stats: 'Sales & payments'
    },
    {
      title: 'Customer Rewards',
      description: 'Monitor customer wallets, rewards and loyalty points',
      icon: '🎁',
      link: '/shopkeeper/rewards',
      badge: 'Rewards',
      color: 'warning',
      stats: 'Customer loyalty'
    }
  ];

  return (
    <Container fluid className="shopkeeper-dashboard-container py-5">
      {/* Professional Header Section */}
      <div className="header-section mb-5">
        <Row className="align-items-center">
          <Col lg={8}>
            <div className="header-content">
              <div className="header-badge mb-3">
                <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
                  ⭐ Dashboard
                </Badge>
              </div>
              <h1 className="header-title mb-3">Welcome back, <span className="highlight">{username}</span></h1>
              <p className="header-subtitle">Manage your store operations from one unified dashboard</p>
            </div>
          </Col>
          <Col lg={4} className="text-end d-none d-lg-block">
            <div className="header-date-time">
              <p className="date-label">Today</p>
              <p className="date-value">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </Col>
        </Row>
      </div>

      {/* Quick Stats Section */}
      <Row className="quick-stats mb-5">
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-primary">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">Total Modules</p>
              <p className="stat-value">4</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-success">
            <div className="stat-icon">📦</div>
            <div className="stat-content">
              <p className="stat-label">Operations</p>
              <p className="stat-value">Active</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-info">
            <div className="stat-icon">💼</div>
            <div className="stat-content">
              <p className="stat-label">Store Status</p>
              <p className="stat-value">Online</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-warning">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <p className="stat-label">Performance</p>
              <p className="stat-value">Good</p>
            </div>
          </div>
        </Col>
      </Row>

      {/* Quick Actions Section */}
      <Row className="quick-actions-section mb-5">
        <Col lg={12}>
          <h3 className="quick-actions-title mb-4">⚡ Quick Actions</h3>
          <Row className="g-3">
            {quickActions.map((action, index) => (
              <Col md={3} sm={6} key={index}>
                <Link to={action.link} className="text-decoration-none">
                  <Button className="quick-action-btn w-100" variant="light">
                    <span className="action-icon">{action.icon}</span>
                    <span className="action-label">{action.label}</span>
                  </Button>
                </Link>
              </Col>
            ))}
          </Row>
        </Col>
      </Row>

      {/* Main Menu Cards Section */}
      <div className="menu-section mb-5">
        <h2 className="section-title mb-4">📋 Core Modules</h2>
        <Row xs={1} md={2} lg={4} className="g-4">
          {menuItems.map((item, index) => (
            <Col key={index}>
              <Link to={item.link} className="text-decoration-none">
                <Card className="menu-card h-100 shadow-lg border-0 transition-all">
                  <div className="card-corner-accent"></div>
                  <Card.Body className="d-flex flex-column p-4">
                    {/* Badge */}
                    <div className="mb-3">
                      <Badge bg={item.color} className="badge-lg">{item.badge}</Badge>
                    </div>

                    {/* Icon with background */}
                    <div className={`menu-icon-wrapper mb-4 ${item.color}`}>
                      <div className="menu-icon">{item.icon}</div>
                    </div>

                    {/* Title */}
                    <Card.Title className="menu-title text-dark mb-2">{item.title}</Card.Title>

                    {/* Description */}
                    <Card.Text className="menu-description text-muted mb-3 flex-grow-1">
                      {item.description}
                    </Card.Text>

                    {/* Stats */}
                    <p className="menu-stats text-secondary mb-3">
                      <span className="stats-icon">→</span> {item.stats}
                    </p>

                    {/* Button */}
                    <Button 
                      variant="light" 
                      className="w-100 menu-button fw-600 mt-auto"
                    >
                      Access Module <span className="ms-2">→</span>
                    </Button>
                  </Card.Body>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      </div>

      {/* Footer Section */}
      <Row className="footer-section">
        <Col md={12}>
          <div className="footer-content">
            <Row>
              <Col md={4} className="footer-col mb-3 mb-md-0">
                <div className="footer-item">
                  <p className="footer-icon">🏪</p>
                  <p className="footer-label">Store</p>
                  <p className="footer-value">E-Kirana Store</p>
                </div>
              </Col>
              <Col md={4} className="footer-col mb-3 mb-md-0">
                <div className="footer-item">
                  <p className="footer-icon">👤</p>
                  <p className="footer-label">Account</p>
                  <p className="footer-value">{username}</p>
                </div>
              </Col>
              <Col md={4} className="footer-col">
                <div className="footer-item">
                  <p className="footer-icon">⏰</p>
                  <p className="footer-label">Last Activity</p>
                  <p className="footer-value">{new Date().toLocaleTimeString()}</p>
                </div>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>
    </Container>
  );
};

export default ShopkeeperDashboard;
