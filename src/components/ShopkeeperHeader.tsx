import { Link } from 'react-router-dom';
import './ShopkeeperHeader.css';

interface ShopkeeperHeaderProps {
  title: string;
  description?: string;
  showDashboardButton?: boolean;
}

const ShopkeeperHeader: React.FC<ShopkeeperHeaderProps> = ({
  title,
  description,
  showDashboardButton = true
}) => {
  return (
    <div className="shopkeeper-header-wrapper">
      <div className="shopkeeper-header">
        {/* Decorative Background Elements */}
        <div className="header-bg-accent header-bg-accent-1"></div>
        <div className="header-bg-accent header-bg-accent-2"></div>
        
        {/* Header Top with Back Button */}
        <div className="header-top">
          {showDashboardButton && (
            <Link to="/shopkeeper" className="back-button-link">
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
            <h1 className="shopkeeper-title">{title}</h1>
            {description && <p className="shopkeeper-description">{description}</p>}
          </div>
          <div className="header-accent-line"></div>
        </div>
      </div>
    </div>
  );
};

export default ShopkeeperHeader;
