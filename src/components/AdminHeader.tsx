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
      <div className="admin-header">
        {/* Decorative Background Elements */}
        <div className="admin-bg-accent admin-bg-accent-1"></div>
        <div className="admin-bg-accent admin-bg-accent-2"></div>
        
        {/* Header Top with Back Button */}
        <div className="header-top">
          {showHomeButton && (
            <Link to="/admin" className="back-button-link">
              <button className="back-button">
                <span className="back-icon">←</span>
                <span className="back-text">Back Home</span>
              </button>
            </Link>
          )}
        </div>
        
        {/* Main Header Content */}
        <div className="header-content">
          <div className="header-title-section">
            <h1 className="admin-title">{title}</h1>
            {description && <p className="admin-description">{description}</p>}
          </div>
          <div className="header-accent-line"></div>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
