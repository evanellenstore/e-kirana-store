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

// GET all products
export const getAllProducts = () => api.get<Product[]>("/products");

// GET categories → returns string[]
export const getCategories = () => api.get<string[]>("/products/categories");

// GET brands by category → returns string[]
export const getBrandsByCategory = (category: string) =>
  api.get<string[]>("/products/search/category", { params: { category } });

// GET product names by brand → returns string[]
export const getNamesByBrand = (brand: string) =>
  api.get<string[]>("/products/search/brand", { params: { brand } });


// GET product by sku → returns Product
export const getProductBySku = (sku: string) =>
  api.get<Product>("/products/search/sku", { params: { sku } });

// CREATE product
export const createProduct = (product: Product) =>
  api.post("/products", product);

// UPDATE product
export const updateProduct = (id: number, product: Product) =>
  api.put(`/products/${id}`, product);

// DELETE product
export const deleteProduct = (id: number) =>
  api.delete(`/products/${id}`);
