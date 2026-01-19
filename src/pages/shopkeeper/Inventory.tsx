import React, { useEffect, useState } from "react";
import {
  Card,
  Spinner,
  Badge,
  Form,
  InputGroup,
  Table,
  Row,
  Col
} from "react-bootstrap";
import api from "../../services/api";

/* =======================
   Interfaces
======================= */

interface Batch {
  batchNo: string;
  expiry: string;
  qty: number;
}

interface InventoryProduct {
  productId: string;
  productSku: string;
  productName: string;
  totalQty: number;
  batches: Batch[];
}

/* =======================
   Constants
======================= */

const LOW_STOCK_LIMIT = 20;
const EXPIRY_WARNING_DAYS = 30;

/* =======================
   Component
======================= */

const Inventory: React.FC = () => {
  const [data, setData] = useState<InventoryProduct[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  /* =======================
     Load Inventory
  ======================= */

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const res = await api.get("/inventory");
        setData(res.data);
        setFilteredData(res.data);
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, []);

  /* =======================
     Search Filter
  ======================= */

  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredData(
      data.filter(
        p =>
          p.productName.toLowerCase().includes(q) ||
          p.productSku.toLowerCase().includes(q)
      )
    );
  }, [search, data]);

  /* =======================
     Helpers
  ======================= */

  const getExpiryBadge = (expiry: string) => {
    const today = new Date();
    const exp = new Date(expiry);
    const diffDays =
      (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return <Badge bg="danger">Expired</Badge>;
    if (diffDays <= EXPIRY_WARNING_DAYS)
      return <Badge bg="warning">Near Expiry</Badge>;
    return <Badge bg="success">Valid</Badge>;
  };

  /* =======================
     Loading UI
  ======================= */

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
        <div className="text-muted mt-2">Loading inventory...</div>
      </div>
    );
  }

  /* =======================
     UI
  ======================= */

  return (
    <div className="mt-4">

      {/* 🔍 Search Header */}
      <Card className="mb-4 shadow-sm">
        <Card.Body className="d-flex justify-content-between align-items-center">
          <Card.Title className="mb-0">📦 Inventory Overview</Card.Title>

          <InputGroup style={{ maxWidth: 320 }}>
            <Form.Control
              placeholder="Search SKU / Product Name"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </InputGroup>
        </Card.Body>
      </Card>

      {/* 🧾 Product Cards */}
      {filteredData.map(product => (
        <Card key={product.productId} className="mb-4 shadow-sm">
          <Card.Body>

            {/* Product Header */}
            <Row className="align-items-center mb-3">
              <Col>
                <h5 className="mb-1">{product.productName}</h5>
                <div className="text-muted">
                  SKU: <strong>{product.productSku}</strong>
                </div>
              </Col>

              <Col xs="auto">
                <h5>
                  <Badge bg="primary">
                    Total Qty: {product.totalQty}
                  </Badge>
                </h5>
              </Col>
            </Row>

            {/* Batch Table */}
            <Table bordered hover responsive className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>Batch No</th>
                  <th>Expiry Date</th>
                  <th className="text-center">Quantity</th>
                  <th className="text-center">Expiry Status</th>
                  <th className="text-center">Stock Status</th>
                </tr>
              </thead>

              <tbody>
                {product.batches.map(batch => {
                  const isLowStock = batch.qty <= LOW_STOCK_LIMIT;

                  return (
                    <tr
                      key={batch.batchNo}
                      className={isLowStock ? "table-warning" : ""}
                    >
                      <td className="fw-semibold">{batch.batchNo}</td>
                      <td>
                        {new Date(batch.expiry).toLocaleDateString()}
                      </td>

                      <td className="text-center fw-bold">
                        {batch.qty}
                      </td>

                      <td className="text-center">
                        {getExpiryBadge(batch.expiry)}
                      </td>

                      <td className="text-center">
                        {isLowStock ? (
                          <Badge bg="danger">Low Stock</Badge>
                        ) : (
                          <Badge bg="success">In Stock</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      ))}

      {/* Empty State */}
      {filteredData.length === 0 && (
        <div className="text-center text-muted mt-5">
          No inventory items found
        </div>
      )}
    </div>
  );
};

export default Inventory;
