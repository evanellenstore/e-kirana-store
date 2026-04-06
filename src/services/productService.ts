import api from "./api";

export interface Product {
  id?: number;
  sku: string;
  name: string;
  description: string;
  category: string;
  brandId?: number;
  brandName?: string;
  unit: string;
  price: number;
  discountAmount?: number;
  status: "ACTIVE" | "INACTIVE";
  barcode?: string;
}

export interface Category {
  id: number;
  category: string;
  isActive: boolean;
}

export interface Brand {
  id: number;
  brand: string;
  isActive: boolean;
}

// GET all products
export const getAllProducts = () => api.get<Product[]>("/products");

// GET categories → returns Category[] (includes inactive for admin)
export const getCategories = () => api.get<Category[]>("/products/categories");

// GET only active categories → returns Category[] (for dropdowns)
export const getActiveCategories = () => api.get<Category[]>("/products/categories/active");

// GET all active brands → returns Brand[] (for dropdowns)
export const getActiveBrands = () => api.get<Brand[]>("/products/brands/active");

// GET brands by category → returns string[]
export const getBrandsByCategory = (category: string) =>
  api.get<string[]>(`/products/brands/category/${category}`);

// GET product names by brand ID → returns string[]
export const getNamesByBrand = (brandId: number) =>
  api.get<string[]>("/products/search/brand", { params: { brandId } });

// GET products by category and brand → returns Product[]
export const getProductsByBrand = (brand: string) =>
  api.get<Product[]>("/products/search/brand-name", { params: { brand } });

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
