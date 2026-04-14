import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { AuthContext } from '../../auth/AuthContext';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const auth = useContext(AuthContext);
  const { t } = useTranslation();
  const username = auth?.user?.username || 'Admin';

  const menuItems = [
    {
      title: t('admin.products'),
      description: t('admin.products'),
      icon: '📦',
      link: '/admin/admin-products',
      badge: 'Manage',
      color: 'primary'
    },
    {
      title: t('admin.categories'),
      description: t('admin.categories'),
      icon: '📂',
      link: '/admin/categories',
      badge: 'Organize',
      color: 'info'
    },
    {
      title: t('admin.brands'),
      description: t('admin.brandManage'),
      icon: '🏷️',
      link: '/admin/brands',
      badge: 'Organize',
      color: 'success'
    },
    {
      title: t('admin.categoryBrandMapping'),
      description: t('admin.categoryBrandDesc'),
      icon: '🔗',
      link: '/admin/category-brand-mapping',
      badge: 'Connect',
      color: 'secondary'
    },
    {
      title: t('shopkeeper.inventory'),
      description: t('shopkeeper.inventory'),
      icon: '📊',
      link: '/admin/admin-inventory',
      badge: 'Track',
      color: 'warning'
    },
    {
      title: t('admin.users'),
      description: t('admin.users'),
      icon: '👥',
      link: '/admin/users',
      badge: 'Control',
      color: 'danger'
    },
    {
      title: t('admin.reports'),
      description: t('admin.reports'),
      icon: '📈',
      link: '/admin/reports',
      badge: 'Analyze',
      color: 'primary'
    },
    {
      title: t('admin.purchases'),
      description: t('admin.purchaseDesc'),
      icon: '🛒',
      link: '/admin/from-purchase',
      badge: 'Process',
      color: 'info'
    },
    {
      title: t('admin.rewards'),
      description: t('admin.rewardsDesc'),
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
              {t('admin.dashboard')}
            </Badge>
            <h2 className="header-title">
              {t('admin.welcome')}, <span>{username}</span>
            </h2>
            <p className="header-subtitle">
              {t('admin.title')}
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