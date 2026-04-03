import React from "react";
import { Navbar, Container, Button } from "react-bootstrap";
import { Link } from "react-router-dom";
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
    <>
      <Navbar bg="dark" variant="dark" expand={false} className="mb-3">
        <Container className="d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <Navbar.Brand as={Link} to="/">E-Kirana</Navbar.Brand>
          </div>

          <div>
            {user ? (
              <div className="d-flex align-items-center">
                <span className="text-light me-3">Welcome, {user.username}</span>
                <Button variant="outline-light" size="sm" onClick={handleLogout}>Logout</Button>
              </div>
            ) : (
              <Link to="/login" className="btn btn-outline-light btn-sm">Login</Link>
            )}
          </div>
        </Container>
      </Navbar>
    </>
  );
};

export default AppNavbar;


