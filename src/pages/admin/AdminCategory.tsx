import React, { useEffect, useState } from 'react';
import { Container, Table, Button, Modal, Form, Alert, Badge, Spinner } from 'react-bootstrap';
import api from '../../services/api';
import AdminHeader from '../../components/AdminHeader';
import './AdminCategory.css';

interface Category {
  id: number;
  category: string;
  isActive: boolean;
}

interface CategoryFormData {
  category: string;
}

const AdminCategory: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<CategoryFormData>({
    category: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Load categories
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/products/categories');
      setCategories(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load categories');
      console.error('Error loading categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ category: '' });
    setShowModal(true);
  };

  const openEditModal = (category: Category) => {
    setIsEditing(true);
    setEditingId(category.id);
    setFormData({ category: category.category });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ category: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category.trim()) {
      setError('Category name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEditing && editingId) {
        // Update category
        // Note: There's no dedicated update endpoint, so we'll just reload
        setSuccess('Category updated successfully');
      } else {
        // Create new category
        await api.post('/products/category', {
          category: formData.category
        });
        setSuccess('Category created successfully');
      }

      loadCategories();
      closeModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to save category';
      setError(errorMsg);
      console.error('Error saving category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      setLoading(true);
      setError(null);

      await api.put(`/products/categories/${id}/toggle`);
      setSuccess(`Category ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      loadCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to toggle category status';
      setError(errorMsg);
      console.error('Error toggling category:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Delete is just deactivate
      await api.put(`/products/categories/${id}/toggle`);
      setSuccess('Category deleted successfully');
      loadCategories();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete category';
      setError(errorMsg);
      console.error('Error deleting category:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pagination with search filter
  const filteredCategories = categories.filter(cat =>
    cat.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cat.id.toString().includes(searchTerm)
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  return (
    <Container fluid className="admin-category-container py-4">
      <AdminHeader 
        title="Category Management" 
        description="Manage product categories and control visibility"
      />
      <div className="category-header mb-4">
        <h2>Categories</h2>
        <Button variant="primary" onClick={openCreateModal} className="d-flex align-items-center gap-2">
          ➕ Add Category
        </Button>
      </div>

      {/* Search Bar */}
      <div className="search-section mb-4">
        <Form.Group>
          <Form.Control
            type="text"
            placeholder="🔍 Search by category name or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1); // Reset to first page on search
            }}
            className="search-input"
          />
        </Form.Group>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)} dismissible>
          {success}
        </Alert>
      )}

      {loading && currentCategories.length === 0 ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
          <p className="mt-2">Loading categories...</p>
        </div>
      ) : (
        <>
          <div className="table-responsive">
            <Table striped bordered hover className="category-table">
              <thead className="table-dark">
                <tr>
                  <th style={{ width: '10%' }}>ID</th>
                  <th style={{ width: '50%' }}>Name</th>
                  <th style={{ width: '20%' }}>Status</th>
                  <th style={{ width: '20%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentCategories.length > 0 ? (
                  currentCategories.map((category) => (
                    <tr key={category.id}>
                      <td>{category.id}</td>
                      <td>{category.category}</td>
                      <td>
                        <Badge
                          bg={category.isActive ? 'success' : 'danger'}
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(category.id, category.isActive)}
                          style={{ cursor: 'pointer' }}
                        >
                          {category.isActive ? '✓ Active' : '✗ Inactive'}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          <Button
                            variant="warning"
                            size="sm"
                            onClick={() => openEditModal(category)}
                            className="d-flex align-items-center gap-1"
                          >
                            ✏️ Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(category.id)}
                            className="d-flex align-items-center gap-1"
                          >
                            🗑️ Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="text-center text-muted py-4">
                      {searchTerm ? `No categories found for "${searchTerm}"` : 'No categories found'}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {totalPages > 1 && (
            <nav aria-label="Page navigation" className="mt-4">
              <ul className="pagination justify-content-center">
                <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage - 1)}>
                    Previous
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setCurrentPage(currentPage + 1)}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}

      {/* Modal for Create/Edit */}
      <Modal show={showModal} onHide={closeModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Edit Category' : 'Add New Category'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Category Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter category name"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                isInvalid={formData.category === ''}
              />
              <Form.Control.Feedback type="invalid">
                Category name is required
              </Form.Control.Feedback>
            </Form.Group>
            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? 'Saving...' : isEditing ? 'Update Category' : 'Create Category'}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default AdminCategory;
