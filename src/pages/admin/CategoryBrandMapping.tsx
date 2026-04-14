import React, { useEffect, useState } from 'react';
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  ListGroup,
  Spinner,
  Alert,
  Badge
} from 'react-bootstrap';
import AdminHeader from '../../components/AdminHeader';
import {
  getCategories,
  getActiveBrands,
  getBrandsByCategory,
  mapBrandToCategory,
  unmapBrandFromCategory,
  type Category,
  type Brand
} from '../../services/productService';
import './CategoryBrandMapping.css';

/* =======================
   Interfaces
======================= */

interface Category {
  id: number;
  category: string;
  isActive: boolean;
}

interface Brand {
  id: number;
  brand: string;
  isActive: boolean;
}

/* =======================
   Component
======================= */

const CategoryBrandMapping: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [allBrands, setAllBrands] = useState<Brand[]>([]);
  const [mappedBrands, setMappedBrands] = useState<Brand[]>([]);
  const [availableBrands, setAvailableBrands] = useState<Brand[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /* =======================
     Load Categories & Brands
  ======================= */

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [categoriesRes, brandsRes] = await Promise.all([
        getCategories(),
        getActiveBrands()
      ]);

      setCategories(categoriesRes.data);
      setAllBrands(brandsRes.data);

      // Set first category as selected if available
      if (categoriesRes.data.length > 0) {
        setSelectedCategory(categoriesRes.data[0].id);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     Load Mapped Brands
  ======================= */

  useEffect(() => {
    if (!selectedCategory) return;

    const loadMappedBrands = async () => {
      try {
        setLoading(true);
        setError(null);
        setSuccess(null);

        const response = await getBrandsByCategory(selectedCategory);
        const mapped = Array.isArray(response.data) ? response.data : [];
        setMappedBrands(mapped);

        // Calculate available brands (not mapped yet)
        const mappedIds = mapped.map(b => b.id);
        const available = allBrands.filter(b => !mappedIds.includes(b.id));
        setAvailableBrands(available);

        setSelectedBrand(null);
      } catch (err: any) {
        console.log('Brands not yet mapped for this category', err?.message);
        setMappedBrands([]);
        setAvailableBrands(allBrands);
      } finally {
        setLoading(false);
      }
    };

    loadMappedBrands();
  }, [selectedCategory, allBrands, categories]);

  /* =======================
     Add Brand Mapping
  ======================= */

  const handleAddMapping = async () => {
    if (!selectedCategory || !selectedBrand) {
      setError('Please select both category and brand');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await mapBrandToCategory(selectedCategory, selectedBrand);

      setSuccess('✅ Brand mapped successfully!');
      setSelectedBrand(null);

      // Reload mapped brands
      const response = await getBrandsByCategory(selectedCategory);
      const mapped = Array.isArray(response.data) ? response.data : [];
      setMappedBrands(mapped);

      const mappedIds = mapped.map(b => b.id);
      const available = allBrands.filter(b => !mappedIds.includes(b.id));
      setAvailableBrands(available);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to add mapping');
      console.error('Add mapping error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     Remove Brand Mapping
  ======================= */

  const handleRemoveMapping = async (brandId: number) => {
    if (!selectedCategory) return;

    if (!window.confirm('Remove this brand mapping?')) return;

    try {
      setLoading(true);
      setError(null);

      await unmapBrandFromCategory(selectedCategory, brandId);

      setSuccess('✅ Brand unmapped successfully!');

      // Reload mapped brands
      const response = await getBrandsByCategory(selectedCategory);
      const mapped = Array.isArray(response.data) ? response.data : [];
      setMappedBrands(mapped);

      const mappedIds = mapped.map(b => b.id);
      const available = allBrands.filter(b => !mappedIds.includes(b.id));
      setAvailableBrands(available);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to remove mapping');
      console.error('Remove mapping error:', err);
    } finally {
      setLoading(false);
    }
  };

  /* =======================
     Get Category Name
  ======================= */

  const getCategoryName = () => {
    return categories.find(c => c.id === selectedCategory)?.category || 'N/A';
  };

  /* =======================
     Render
  ======================= */

  if (loading && categories.length === 0) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
        <div className="text-muted mt-2">Loading...</div>
      </div>
    );
  }

  return (
    <div className="category-brand-mapping-page">
      <AdminHeader />

      <Container className="mt-4 mb-5">
        <h2 className="text-center mb-4">
          📋 Category & Brand Mapping
        </h2>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Row className="g-4">
          {/* =======================
             LEFT: Category Selection
          ======================= */}

          <Col lg={4}>
            <Card className="shadow-sm h-100">
              <Card.Header className="bg-primary text-white">
                <Card.Title className="mb-0">
                  📁 Categories
                </Card.Title>
              </Card.Header>

              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Select Category</Form.Label>
                  <Form.Select
                    value={selectedCategory || ''}
                    onChange={e => setSelectedCategory(Number(e.target.value))}
                  >
                    <option value="">-- Select Category --</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.category}
                        {!cat.isActive && ' (inactive)'}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {selectedCategory && (
                  <Alert variant="info" className="mb-0">
                    <strong>Selected:</strong> {getCategoryName()}
                  </Alert>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* =======================
             CENTER: Add Brand Mapping
          ======================= */}

          <Col lg={4}>
            <Card className="shadow-sm h-100">
              <Card.Header className="bg-success text-white">
                <Card.Title className="mb-0">
                  ➕ Add Brand Mapping
                </Card.Title>
              </Card.Header>

              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="fw-bold">Available Brands</Form.Label>
                  <Form.Select
                    value={selectedBrand || ''}
                    onChange={e => setSelectedBrand(Number(e.target.value) || null)}
                    disabled={!selectedCategory || availableBrands.length === 0}
                  >
                    <option value="">-- Select Brand --</option>
                    {availableBrands.map(brand => (
                      <option key={brand.id} value={brand.id}>
                        {brand.brand}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                {!selectedCategory && (
                  <Alert variant="warning" className="small mb-3">
                    Please select a category first
                  </Alert>
                )}

                {selectedCategory && availableBrands.length === 0 && (
                  <Alert variant="info" className="small mb-3">
                    All brands are already mapped to this category
                  </Alert>
                )}

                <Button
                  variant="success"
                  className="w-100"
                  disabled={!selectedCategory || !selectedBrand || loading}
                  onClick={handleAddMapping}
                >
                  {loading ? 'Adding...' : '✓ Add Mapping'}
                </Button>
              </Card.Body>
            </Card>
          </Col>

          {/* =======================
             RIGHT: Mapped Brands
          ======================= */}

          <Col lg={4}>
            <Card className="shadow-sm h-100">
              <Card.Header className="bg-info text-white">
                <Card.Title className="mb-0">
                  ✓ Mapped Brands ({mappedBrands.length})
                </Card.Title>
              </Card.Header>

              <Card.Body className="p-0">
                {mappedBrands.length === 0 ? (
                  <div className="p-3 text-muted text-center">
                    <small>No brands mapped yet</small>
                  </div>
                ) : (
                  <ListGroup variant="flush">
                    {mappedBrands.map(brand => (
                      <ListGroup.Item 
                        key={brand.id}
                        className="d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <div className="fw-semibold">{brand.brand}</div>
                          {!brand.isActive && (
                            <Badge bg="warning" className="small">
                              Inactive
                            </Badge>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleRemoveMapping(brand.id)}
                          disabled={loading}
                          title="Remove mapping"
                        >
                          ✕
                        </Button>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* =======================
           Summary Section
        ======================= */}

        <Card className="mt-4 shadow-sm border-0 bg-light">
          <Card.Body>
            <Row className="text-center">
              <Col md={3}>
                <div className="fs-5 fw-bold text-primary">
                  {categories.length}
                </div>
                <small className="text-muted">Total Categories</small>
              </Col>
              <Col md={3}>
                <div className="fs-5 fw-bold text-success">
                  {allBrands.length}
                </div>
                <small className="text-muted">Total Brands</small>
              </Col>
              <Col md={3}>
                <div className="fs-5 fw-bold text-info">
                  {mappedBrands.length}
                </div>
                <small className="text-muted">
                  Brands in {getCategoryName()}
                </small>
              </Col>
              <Col md={3}>
                <div className="fs-5 fw-bold text-warning">
                  {availableBrands.length}
                </div>
                <small className="text-muted">Available to Map</small>
              </Col>
            </Row>
          </Card.Body>
        </Card>
      </Container>
    </div>
  );
};

export default CategoryBrandMapping;
