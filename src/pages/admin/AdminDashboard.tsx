import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import AdminHeader from '../../components/AdminHeader';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const menuItems = [
    {
      title: 'Products',
      description: 'Manage product catalog',
      icon: '📦',
      link: '/admin/admin-products'
    },
    {
      title: 'Categories',
      description: 'Manage product categories',
      icon: '📂',
      link: '/admin/categories'
    },
    {
      title: 'Inventory',
      description: 'Manage inventory stock',
      icon: '📊',
      link: '/admin/admin-inventory'
    },
    {
      title: 'Users',
      description: 'Manage system users',
      icon: '👥',
      link: '/admin/users'
    },
    {
      title: 'Reports',
      description: 'View sales and analytics',
      icon: '📈',
      link: '/admin/reports'
    },
    {
      title: 'From Purchase',
      description: 'Process purchases',
      icon: '🛒',
      link: '/admin/from-purchase'
    }
  ];

  return (
    <Container fluid className="admin-dashboard-container py-5">
      <AdminHeader 
        title="Admin Dashboard" 
        description="Manage your e-commerce platform"
        showHomeButton={false}
      />
      <Row xs={1} md={2} lg={3} className="g-4">
        {menuItems.map((item, index) => (
          <Col key={index}>
            <Card className="menu-card h-100 shadow-sm">
              <Card.Body className="d-flex flex-column">
                <div className="menu-icon mb-3">{item.icon}</div>
                <Card.Title className="menu-title">{item.title}</Card.Title>
                <Card.Text className="menu-description text-muted">
                  {item.description}
                </Card.Text>
                <Link to={item.link} className="mt-auto">
                  <Button variant="primary" className="w-100">
                    Open
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>
    </Container>
  );
};

export default AdminDashboard;
