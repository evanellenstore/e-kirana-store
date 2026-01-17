import React, { useEffect, useState } from "react";
import { Container, Table,  Spinner } from "react-bootstrap";
import {
  getAllProducts,
  type Product
} from "../../services/productService";

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const emptyProduct: Product = {
    sku: "",
    name: "",
    description: "",
    category: "",
    brand: "",
    unit: "",
    price: 0,
    status: "ACTIVE",
  };

  const [formData, setFormData] = useState<Product>(emptyProduct);

  const loadProducts = () => {
    setLoading(true);
    getAllProducts()
      .then(res => setProducts(res.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openModal = (product?: Product) => {
    setEditing(product || null);
    setFormData(product ? product : emptyProduct);
    setShow(true);
  };


  if (loading)
    return <div className="text-center mt-5"><Spinner /></div>;

  return (
    <Container className="mt-4">
      <h3 className="text-center mb-4">🛒 Shopkeeper – Product Management</h3>

      <Table bordered hover responsive>
        <thead className="table-dark">
          <tr>
            <th>ID</th>
            <th>SKU</th>
            <th>Name</th>
            <th>Brand</th>
            <th>Category</th>
            <th>Unit</th>
            <th>Price</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.sku}</td>
              <td>{p.name}</td>
              <td>{p.brand}</td>
              <td>{p.category}</td>
              <td>{p.unit}</td>
              <td>₹{p.price}</td>
              <td>{p.status}</td>
            </tr>
          ))}
        </tbody>
      </Table>

     
     
    </Container>
  );
};

export default Products;
