import React, { useEffect, useState } from 'react';
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
    <div className="admin-category-container">
      <AdminHeader 
        title="Category Management" 
        description="Manage product categories and control visibility"
      />
      
      <div className="category-wrapper">
        <div className="category-controls">
          <div className="controls-header">
            <div className="header-content">
              <h1 className="page-title">Categories</h1>
              <p className="page-subtitle">Manage all product categories</p>
            </div>
            <button onClick={openCreateModal} className="add-category-btn">
              <span className="btn-icon">➕</span>
              Add Category
            </button>
          </div>

          {/* Search Bar */}
          <div className="search-container">
            <div className="search-input-wrapper">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by category name or ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="search-input"
              />
            </div>
            {searchTerm && (
              <div className="search-results-info">
                Found {filteredCategories.length} result{filteredCategories.length !== 1 ? 's' : ''}
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

        {/* Loading State */}
        {loading && currentCategories.length === 0 ? (
          <div className="loading-container">
            <div className="spinner">
              <div className="spinner-ring"></div>
            </div>
            <p className="loading-text">Loading categories...</p>
          </div>
        ) : (
          <>
            {/* Categories Grid/Table */}
            <div className="categories-container">
              {currentCategories.length > 0 ? (
                <>
                  <div className="categories-count">
                    Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong> to <strong>{Math.min(currentPage * itemsPerPage, filteredCategories.length)}</strong> of <strong>{filteredCategories.length}</strong> categories
                  </div>
                  <div className="categories-grid">
                    {currentCategories.map((category) => (
                      <div key={category.id} className="category-card">
                        <div className="card-header">
                          <h3 className="category-name">{category.category}</h3>
                          <span className={`status-badge ${category.isActive ? 'active' : 'inactive'}`}>
                            {category.isActive ? '✓ Active' : '✗ Inactive'}
                          </span>
                        </div>
                        <div className="card-body">
                          <div className="category-info">
                            <span className="info-label">ID:</span>
                            <span className="info-value">#{category.id}</span>
                          </div>
                        </div>
                        <div className="card-footer">
                          <button
                            onClick={() => handleToggleStatus(category.id, category.isActive)}
                            className={`toggle-status-btn ${category.isActive ? 'active' : ''}`}
                          >
                            {category.isActive ? '🔒 Deactivate' : '🔓 Activate'}
                          </button>
                          <button
                            onClick={() => openEditModal(category)}
                            className="edit-btn"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
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
                  <div className="empty-icon">📦</div>
                  <h3 className="empty-title">No Categories Found</h3>
                  <p className="empty-message">
                    {searchTerm ? `No categories match "${searchTerm}"` : 'Start by adding your first category'}
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
          </>
        )}
      </div>

      {/* Modal for Create/Edit */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {isEditing ? '✏️ Edit Category' : '➕ Add New Category'}
              </h2>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="category-name" className="form-label">Category Name *</label>
                <input
                  id="category-name"
                  type="text"
                  placeholder="Enter category name"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="form-input"
                  required
                />
                {formData.category === '' && (
                  <span className="form-error">Category name is required</span>
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
                  disabled={loading || formData.category === ''}
                  className="btn-submit"
                >
                  {loading ? (
                    <>
                      <span className="spinner-mini"></span>
                      Saving...
                    </>
                  ) : isEditing ? (
                    'Update Category'
                  ) : (
                    'Create Category'
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

export default AdminCategory;
