import React, { useEffect, useState } from "react";
import { Table, Spinner } from "react-bootstrap";
import api from "../../services/api";

const InventoryList: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/inventory")
      .then(res => setData(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <Table bordered hover>
      <thead>
        <tr>
          <th>Product</th>
          <th>reservedQty</th>
          <th>Available Qty</th>
        </tr>
      </thead>
      <tbody>
        {data.map(i => (
          <tr key={i.productId}>
            <td>{i.productId}</td>
            <td>{i.reservedQty}</td>
            <td>{i.availableQty}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default InventoryList;
