import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import AdminHeader from '../../components/AdminHeader';
import './AdminBrand.css';

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
      <div className="admin-brand-container">
        <div className="loading-container">
          <div className="spinner">
            <div className="spinner-ring"></div>
          </div>
          <p className="loading-text">Loading brands...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-brand-container">
      <AdminHeader 
        title="Brand Management" 
        description="Manage product brands and control availability"
      />
      
      <div className="brand-wrapper">
        <div className="brand-controls">
          <div className="controls-header">
            <div className="header-content">
              <h1 className="page-title">Brands</h1>
              <p className="page-subtitle">Manage all product brands</p>
            </div>
            <button onClick={openCreateModal} className="add-brand-btn">
              <span className="btn-icon">➕</span>
              Add Brand
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by brand name or ID..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
              />
            </div>
            {searchTerm && (
              <div className="search-results-info">
                Found {filteredBrands.length} result{filteredBrands.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Alert Messages */}
        {error && (
          <div className="alert-message alert-danger">
            <span className="alert-icon">⚠️</span>
            <span className="alert-text">{error}</span>
            <button className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        {success && (
          <div className="alert-message alert-success">
            <span className="alert-icon">✓</span>
            <span className="alert-text">{success}</span>
            <button className="alert-close" onClick={() => setSuccess(null)}>×</button>
          </div>
        )}

        {/* Brands Grid */}
        <div className="brands-container">
          {currentBrands.length > 0 ? (
            <>
              <div className="brands-count">
                Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredBrands.length)}</strong> of <strong>{filteredBrands.length}</strong> brands
              </div>
              <div className="brands-grid">
                {currentBrands.map((brand) => (
                  <div key={brand.id} className="brand-card">
                    <div className="card-header">
                      <h3 className="brand-name">{brand.brand}</h3>
                      <span className={`status-badge ${brand.isActive ? 'active' : 'inactive'}`}>
                        {brand.isActive ? '✓ Active' : '✗ Inactive'}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="brand-info">
                        <span className="info-label">ID:</span>
                        <span className="info-value">#{brand.id}</span>
                      </div>
                    </div>
                    <div className="card-footer">
                      <button
                        onClick={() => openEditModal(brand)}
                        className="edit-btn"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(brand.id, brand.isActive)}
                        className={`toggle-status-btn ${brand.isActive ? 'active' : ''}`}
                      >
                        {brand.isActive ? '🔒 Deactivate' : '🔓 Activate'}
                      </button>
                      <button
                        onClick={() => handleDelete(brand.id)}
                        className="delete-btn"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🏷️</div>
              <h3 className="empty-title">No Brands Found</h3>
              <p className="empty-message">
                {searchTerm ? `No brands match "${searchTerm}"` : 'Start by adding your first brand'}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-container">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="pagination-btn pagination-prev"
            >
              ← Previous
            </button>
            <div className="pagination-info">
              Page <span className="current-page">{currentPage}</span> of <span className="total-pages">{totalPages}</span>
            </div>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="pagination-btn pagination-next"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditing ? '✏️ Edit Brand' : '➕ Add New Brand'}
              </h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="brand-name" className="form-label">Brand Name *</label>
                <input
                  id="brand-name"
                  type="text"
                  placeholder="Enter brand name"
                  value={formData.brand}
                  onChange={(e) => setFormData({ brand: e.target.value })}
                  className="form-input"
                  required
                  autoFocus
                />
                {formData.brand === '' && (
                  <span className="form-error">Brand name is required</span>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || formData.brand === ''}
                  className="btn-submit"
                >
                  {loading ? (
                    <>
                      <span className="spinner-mini"></span>
                      Saving...
                    </>
                  ) : isEditing ? (
                    'Update Brand'
                  ) : (
                    'Add Brand'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBrand;
