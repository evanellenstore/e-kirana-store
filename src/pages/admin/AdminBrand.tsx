import React, { useEffect, useState } from 'react';
import { Container, Table, Button, Modal, Form, Alert, Badge, Spinner, Row, Col } from 'react-bootstrap';
import api from '../../services/api';
import AdminHeader from '../../components/AdminHeader';

interface Brand {
  id: number;
  brand: string;
  isActive: boolean;
}

interface BrandFormData {
  brand: string;
}

const AdminBrand: React.FC = () => {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form state
  const [formData, setFormData] = useState<BrandFormData>({
    brand: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Search state
  const [searchTerm, setSearchTerm] = useState('');

  // Load brands
  useEffect(() => {
    loadBrands();
  }, []);

  const loadBrands = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/products/brands');
      setBrands(response.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load brands');
      console.error('Error loading brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setFormData({ brand: '' });
    setShowModal(true);
  };

  const openEditModal = (brand: Brand) => {
    setIsEditing(true);
    setEditingId(brand.id);
    setFormData({ brand: brand.brand });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setFormData({ brand: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.brand.trim()) {
      setError('Brand name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isEditing && editingId) {
        // Update brand
        await api.put(`/products/brand/${editingId}`, {
          brand: formData.brand
        });
        setSuccess('Brand updated successfully');
      } else {
        // Create new brand
        await api.post('/products/brand', {
          brand: formData.brand
        });
        setSuccess('Brand created successfully');
      }

      loadBrands();
      closeModal();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to save brand';
      setError(errorMsg);
      console.error('Error saving brand:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      setLoading(true);
      setError(null);

      await api.put(`/products/brand/${id}/toggle`);
      setSuccess(`Brand ${currentStatus ? 'deactivated' : 'activated'} successfully`);
      loadBrands();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to toggle brand status';
      setError(errorMsg);
      console.error('Error toggling brand:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this brand?')) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.delete(`/products/brand/${id}`);
      setSuccess('Brand deleted successfully');
      loadBrands();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to delete brand';
      setError(errorMsg);
      console.error('Error deleting brand:', err);
    } finally {
      setLoading(false);
    }
  };

  // Pagination with search filter
  const filteredBrands = brands.filter(brand =>
    brand.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    brand.id.toString().includes(searchTerm)
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBrands = filteredBrands.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBrands.length / itemsPerPage);

  if (loading && brands.length === 0) {
    return (
      <div className="text-center mt-5">
        <Spinner />
      </div>
    );
  }

  return (
    <Container fluid className="py-4">
      <AdminHeader 
        title="Brand Management" 
        description="Manage product brands and control availability"
      />

      <Row className="mb-4 align-items-center">
        <Col>
          <h2>Brands</h2>
        </Col>
        <Col className="text-end">
          <Button variant="success" onClick={openCreateModal} className="d-flex align-items-center gap-2 ms-auto">
            <span>➕</span>
            <span>Add Brand</span>
          </Button>
        </Col>
      </Row>

      {/* Search Bar */}
      <div className="mb-4">
        <Form.Group>
          <Form.Control
            type="text"
            placeholder="🔍 Search by brand name or ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
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

      {/* Brands Table */}
      <div className="table-responsive mb-4">
        <Table striped bordered hover>
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>Brand Name</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentBrands.length > 0 ? (
              currentBrands.map((brand) => (
                <tr key={brand.id}>
                  <td>{brand.id}</td>
                  <td className="fw-semibold">{brand.brand}</td>
                  <td>
                    <Badge bg={brand.isActive ? 'success' : 'secondary'}>
                      {brand.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td>
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="me-2"
                      onClick={() => openEditModal(brand)}
                    >
                      ✏️ Edit
                    </Button>
                    <Button
                      variant={brand.isActive ? 'outline-warning' : 'outline-success'}
                      size="sm"
                      className="me-2"
                      onClick={() => handleToggleStatus(brand.id, brand.isActive)}
                    >
                      {brand.isActive ? '❌ Deactivate' : '✅ Activate'}
                    </Button>
                    <Button
                      variant="outline-danger"
                      size="sm"
                      onClick={() => handleDelete(brand.id)}
                    >
                      🗑️ Delete
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center text-muted py-4">
                  No brands found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center gap-2 mb-4">
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </Button>
          <span className="align-self-center">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline-secondary"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Modal */}
      <Modal show={showModal} onHide={closeModal}>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? 'Edit Brand' : 'Add New Brand'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Brand Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter brand name"
                value={formData.brand}
                onChange={(e) => setFormData({ brand: e.target.value })}
                autoFocus
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeModal}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <Spinner size="sm" className="me-2" /> : null}
            {isEditing ? 'Update Brand' : 'Add Brand'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default AdminBrand;
