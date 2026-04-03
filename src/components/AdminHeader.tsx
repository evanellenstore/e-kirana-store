import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './AdminHeader.css';

interface AdminHeaderProps {
  title: string;
  description?: string;
  showHomeButton?: boolean;
}

const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  description,
  showHomeButton = true
}) => {
  return (
    <div className="admin-header-wrapper">
      {showHomeButton && (
        <div className="admin-top-nav">
          <Link to="/admin" className="home-button-link">
            <Button variant="outline-primary" className="home-button">
              🏠 Dashboard
            </Button>
          </Link>
        </div>
      )}
      <div className="admin-header">
        <div className="header-content">
          <h1 className="admin-title">{title}</h1>
          {description && <p className="admin-description">{description}</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
