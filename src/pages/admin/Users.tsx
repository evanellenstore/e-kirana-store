import React, { useEffect, useState } from "react";
import {
  Container,
  Table,
  Button,
  Modal,
  Form,
  Spinner,
  Alert,
} from "react-bootstrap";
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser
} from "../../services/userService";

import type { UserDto } from "../../services/userService";


const Users: React.FC = () => {
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);

  const [formData, setFormData] = useState<UserDto>({
    username: "",
    role: "ADMIN",
    email: "",
    password: "",
    active: true,
  });

  // 🔹 Load users
  const loadUsers = async () => {
    console.log("===From Users of method loadUsers: Loading users===");
    try {
      setLoading(true);
      const res = await getUsers();
      setUsers(res.data);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("===From Users of method useEffect: Loading users===");
    loadUsers();
  }, []);

  // 🔹 Open create modal
  const handleAdd = () => {
    setEditingUser(null);
    setFormData({ username: "", role: "ADMIN", email: "", password: "", active: true });
    setShowModal(true);
  };

  // 🔹 Open edit modal
  const handleEdit = (user: UserDto) => {
    setEditingUser(user);
    setFormData(user);
    setShowModal(true);
  };

  // 🔹 Save (create/update)
  const handleSave = async () => {
    try {
      if (editingUser?.id) {
        await updateUser(editingUser.id, formData);
      } else {
        await createUser(formData);
      }
      setShowModal(false);
      loadUsers();
    } catch {
      alert("Operation failed");
    }
  };

  // 🔹 Delete
  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm("Are you sure?")) return;

    await deleteUser(id);
    loadUsers();
  };

  return (
    <Container className="mt-4">
      <div className="d-flex justify-content-between mb-3">
        <h3>Admin Users</h3>
        <Button onClick={handleAdd}>+ Add User</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <Spinner animation="border" />
      ) : (
        <Table striped bordered hover>
          <thead>
            <tr>
              <th>ID</th>
              <th>Username</th>
              <th>Role</th>
              <th style={{ width: "180px" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.id}</td>
                <td>{u.username}</td>
                <td>{u.role}</td>
                <td>{u.email}</td>
                <td>{u.active ? "Yes" : "No"}</td>
                <td>
                  <Button
                    size="sm"
                    variant="warning"
                    className="me-2"
                    onClick={() => handleEdit(u)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(u.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      {/* Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {editingUser ? "Edit User" : "Create User"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Username</Form.Label>
              <Form.Control
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
              />
            </Form.Group>
            
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
              />
            </Form.Group>

            <Form.Group>
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={formData.role}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              >
                <option value="ADMIN">ADMIN</option>
                <option value="SHOPKEEPER">SHOPKEEPER</option>
                <option value="CUSTOMER">CUSTOMER</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {editingUser ? "Update" : "Create"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Users;
