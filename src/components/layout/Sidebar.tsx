import { useContext } from "react";
import { AuthContext } from "../../auth/AuthContext";
import { Nav } from "react-bootstrap";
import { Link } from "react-router-dom";

const Sidebar = () => {
  const auth = useContext(AuthContext);
  const role = auth?.user?.role;

  return (
    <div
      className="bg-light border-end"
      style={{ width: "220px", minHeight: "100vh" }}
    >
      <Nav className="flex-column p-3">
        <h6 className="text-muted mb-3">MENU</h6>

        {role === "ADMIN" && (
          <>
            <Nav.Link as={Link} to="/admin">
              Dashboard
            </Nav.Link>
            <Nav.Link as={Link} to="/admin/users">Users</Nav.Link>
            <Nav.Link as={Link} to="/admin/reports">Reports</Nav.Link>
          </>
        )}

        {role === "SHOPKEEPER" && (
          <>
            <Nav.Link as={Link} to="/shopkeeper">Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/shopkeeper/products">Products</Nav.Link>
            <Nav.Link as={Link} to="/shopkeeper/inventory">Inventory</Nav.Link>
            <Nav.Link as={Link} to="/shopkeeper/billing">Billing</Nav.Link>
          </>
        )}

        {role === "CUSTOMER" && (
          <>
            <Nav.Link as={Link} to="/customer">Dashboard</Nav.Link>
            <Nav.Link as={Link} to="/customer/products">Products</Nav.Link>
            <Nav.Link as={Link} to="/customer/cart">Cart</Nav.Link>
            <Nav.Link as={Link} to="/customer/orders">Orders</Nav.Link>
          </>
        )}
      </Nav>
    </div>
  );
};

export default Sidebar;
