import React from "react";
import { Navbar, Nav, Container, Button } from "react-bootstrap";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";

const AppNavbar: React.FC = () => {
  const { user, logout } = useAuth(); // get user and logout from context
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();           // clear user state and localStorage
    navigate("/login"); // redirect to login page
  };

  return (
    <Navbar bg="dark" variant="dark" expand="lg">
      <Container>
        <Navbar.Brand href="/">E-Kirana</Navbar.Brand>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            {user?.role === "ADMIN" && <Nav.Link href="/admin">Admin</Nav.Link>}
            {user?.role === "SHOPKEEPER" && <Nav.Link href="/shopkeeper">Shopkeeper</Nav.Link>}
            {user?.role === "CUSTOMER" && <Nav.Link href="/customer">Customer</Nav.Link>}
          </Nav>

          <Nav className="ms-auto">
            {user ? (
              <>
                <Navbar.Text className="me-2">Welcome, {user.username}</Navbar.Text>
                <Button variant="outline-light" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <Nav.Link href="/login">Login</Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;


