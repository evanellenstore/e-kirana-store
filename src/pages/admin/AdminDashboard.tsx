import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../../auth/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const auth = useContext(AuthContext);
  const username = auth?.user?.username || 'Admin';
  
  // Quick action buttons
  const quickActions = [
    { label: 'New Product', icon: '➕', color: 'primary', link: '/admin/admin-products' },
    { label: 'View Reports', icon: '📊', color: 'info', link: '/admin/reports' },
    { label: 'Manage Users', icon: '👥', color: 'warning', link: '/admin/users' },
    { label: 'Check Inventory', icon: '📦', color: 'success', link: '/admin/admin-inventory' }
  ];
  
  const menuItems = [
    {
      title: 'Products',
      description: 'Browse, create and manage your product catalog with advanced features',
      icon: '📦',
      link: '/admin/admin-products',
      badge: 'Manage',
      color: 'primary',
      stats: 'Catalog management'
    },
    {
      title: 'Categories',
      description: 'Organize products into logical categories for better navigation',
      icon: '📂',
      link: '/admin/categories',
      badge: 'Organize',
      color: 'info',
      stats: 'Category control'
    },
    {
      title: 'Brands',
      description: 'Manage brand information and brand-specific settings',
      icon: '🏷️',
      link: '/admin/brands',
      badge: 'Organize',
      color: 'success',
      stats: 'Brand registry'
    },
    {
      title: 'Inventory',
      description: 'Monitor stock levels, manage warehouses and reorder points',
      icon: '📊',
      link: '/admin/admin-inventory',
      badge: 'Track',
      color: 'warning',
      stats: 'Stock control'
    },
    {
      title: 'Users',
      description: 'Control user access, roles and permissions across the platform',
      icon: '👥',
      link: '/admin/users',
      badge: 'Control',
      color: 'danger',
      stats: 'User management'
    },
    {
      title: 'Reports',
      description: 'Generate sales reports, analytics and business intelligence',
      icon: '📈',
      link: '/admin/reports',
      badge: 'Analyze',
      color: 'primary',
      stats: 'Analytics & insights'
    },
    {
      title: 'From Purchase',
      description: 'Process and manage purchase orders and inventory updates',
      icon: '🛒',
      link: '/admin/from-purchase',
      badge: 'Process',
      color: 'info',
      stats: 'Order processing'
    },
    {
      title: 'Customer Rewards',
      description: 'Manage customer loyalty programs, wallets and reward points',
      icon: '💰',
      link: '/admin/rewards',
      badge: 'Rewards',
      color: 'success',
      stats: 'Loyalty programs'
    }
  ];

  return (
    <Container fluid className="admin-dashboard-container py-5">
      {/* Professional Header Section */}
      <div className="header-section mb-5">
        <Row className="align-items-center">
          <Col lg={8}>
            <div className="header-content">
              <div className="header-badge mb-3">
                <Badge bg="light" text="dark" className="fs-6 px-3 py-2">
                  👑 Admin Panel
                </Badge>
              </div>
              <h1 className="header-title mb-3">Welcome back, <span className="highlight">{username}</span></h1>
              <p className="header-subtitle">Complete control over your e-commerce platform and operations</p>
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
            <div className="stat-icon">🎯</div>
            <div className="stat-content">
              <p className="stat-label">Total Modules</p>
              <p className="stat-value">8</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-success">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <p className="stat-label">Access Level</p>
              <p className="stat-value">Full</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-info">
            <div className="stat-icon">🔐</div>
            <div className="stat-content">
              <p className="stat-label">Security</p>
              <p className="stat-value">Active</p>
            </div>
          </div>
        </Col>
        <Col md={3} sm={6} className="mb-3">
          <div className="stat-card stat-card-warning">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <p className="stat-label">System Status</p>
              <p className="stat-value">Online</p>
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
        <h2 className="section-title mb-4">⚙️ Management Modules</h2>
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
                  <p className="footer-icon">🏢</p>
                  <p className="footer-label">Platform</p>
                  <p className="footer-value">E-Commerce Pro</p>
                </div>
              </Col>
              <Col md={4} className="footer-col mb-3 mb-md-0">
                <div className="footer-item">
                  <p className="footer-icon">👤</p>
                  <p className="footer-label">Role</p>
                  <p className="footer-value">Administrator</p>
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

export default AdminDashboard;
