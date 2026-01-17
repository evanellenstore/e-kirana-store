import React, { useEffect, useState } from "react";
import {
  Table,
  Spinner,
  Card,
  Badge,
  Form,
  InputGroup
} from "react-bootstrap";
import api from "../../services/api";

interface InventoryRow {
  productId: number;
  reservedQty: number;
  availableQty: number;
  productName?: string;
  sku?: string;
}

const LOW_STOCK_LIMIT = 10;

const Inventory: React.FC = () => {
  const [data, setData] = useState<InventoryRow[]>([]);
  const [filteredData, setFilteredData] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const inventoryRes = await api.get("/inventory");
        const inventoryData: InventoryRow[] = inventoryRes.data;

        const enrichedData = await Promise.all(
          inventoryData.map(async (item) => {
            try {
              const productRes = await api.get(`/products/${item.productId}`);
              return {
                ...item,
                productName: productRes.data.name,
                sku: productRes.data.sku
              };
            } catch {
              return {
                ...item,
                productName: "Unknown",
                sku: "N/A"
              };
            }
          })
        );

        setData(enrichedData);
        setFilteredData(enrichedData);
      } finally {
        setLoading(false);
      }
    };

    loadInventory();
  }, []);

  /* 🔍 Search filter */
  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredData(
      data.filter(
        d =>
          d.productName?.toLowerCase().includes(q) ||
          d.sku?.toLowerCase().includes(q)
      )
    );
  }, [search, data]);

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
        <div className="mt-2 text-muted">Loading inventory...</div>
      </div>
    );
  }

  return (
    <Card className="shadow-sm mt-4">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <Card.Title className="mb-0">📦 Inventory Overview</Card.Title>

          <InputGroup style={{ maxWidth: 300 }}>
            <Form.Control
              placeholder="Search SKU / Product"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </InputGroup>
        </div>

        <Table bordered hover responsive className="align-middle">
          <thead className="table-light">
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th className="text-center">Reserved</th>
              <th className="text-center">Available</th>
              <th className="text-center">Status</th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map(item => {
              const isLowStock = item.availableQty <= LOW_STOCK_LIMIT;

              return (
                <tr
                  key={item.productId}
                  className={isLowStock ? "table-warning" : ""}
                >
                  <td className="fw-semibold">{item.sku}</td>
                  <td>{item.productName}</td>

                  <td className="text-center">
                    <Badge bg="secondary">
                      {item.reservedQty}
                    </Badge>
                  </td>

                  <td className="text-center fw-bold">
                    {item.availableQty}
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

            {filteredData.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center text-muted py-4">
                  No inventory items found
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card.Body>
    </Card>
  );
};

export default Inventory;
