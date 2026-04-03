import { Button } from 'react-bootstrap';
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
        <div className="header-top">
          {showDashboardButton && (
            <Link to="/shopkeeper" className="dashboard-button-link">
              <Button variant="outline-success" className="dashboard-button">
                ← Back to Dashboard
              </Button>
            </Link>
          )}
        </div>
        <div className="header-content">
          <h1 className="shopkeeper-title">{title}</h1>
          {description && <p className="shopkeeper-description">{description}</p>}
        </div>
      </div>
    </div>
  );
};

export default ShopkeeperHeader;
