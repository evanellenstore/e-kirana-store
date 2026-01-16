import api from "./api";

export interface Product {
  id?: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  unit: string;
  price: number;
  status: "ACTIVE" | "INACTIVE";
}

// ✅ GET all products
export const getAllProducts = () =>
  api.get<Product[]>("/products");

// ✅ GET product by ID
export const getProductById = (id: number) =>
  api.get<Product>(`/products/${id}`);

// ✅ CREATE product  ← THIS MUST EXIST
export const createProduct = (product: Product) =>
  api.post("/products", product);

// ✅ UPDATE product
export const updateProduct = (id: number, product: Product) =>
  api.put(`/products/${id}`, product);

// ✅ DELETE product
export const deleteProduct = (id: number) =>
  api.delete(`/products/${id}`);
