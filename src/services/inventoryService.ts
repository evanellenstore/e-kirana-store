import api from "./api";

export interface InventoryStatus {
  productId: number;
  availableQty: number;
  reservedQty: number;
}

export interface ReservedItem {
  referenceId: string;
  quantity: number;
  reservedDate?: string;
  sku?: string;
  productName?: string;
  productId?: number;
  batchNo?: string;
}

export interface BatchInfo {
  id?: number;
  batchNo: string;
  availableQty: number;
  reservedQty: number;
  expiryDate: string | Date;
  manufacturingDate?: string | Date;
  supplierName?: string;
  productId?: number;
}

// GET inventory by product ID
export const getInventory = (productId: number) =>
  api.get<InventoryStatus>(`/inventory/${productId}`);

// GET reserved items for a product
export const getReservedItems = (productId: number) =>
  api.get<ReservedItem[]>(`/inventory/${productId}/reserved-items`);

// GET all reserved items (for all products)
export const getAllReservedItems = () =>
  api.get<ReservedItem[]>(`/inventory/reserved-items-all`);

// GET available batches for a product
export const getBatches = (productId: number) =>
  api.get<BatchInfo[]>(`/inventory/batches?productId=${productId}`);

// ADJUST inventory (IN / OUT)
export const adjustInventory = (
  productId: number,
  quantity: number,
  type: "IN" | "OUT",
  remarks: string
) =>
  api.put(`/inventory/${productId}/adjust`, {
    quantity,
    type,
    remarks,
  });

// RESERVE inventory (with batchNo)
export const reserveInventory = (
  productId: number,
  quantity: number,
  referenceId: string,
  batchNo: string
) =>
  api.put(`/inventory/${productId}/reserve?batchNo=${batchNo}`, {
    quantity,
    referenceId,
  });

// RELEASE inventory
export const releaseInventory = (
  productId: number,
  quantity: number,
  referenceId: string
) =>
  api.put(`/inventory/${productId}/release`, {
    quantity,
    referenceId,
  });

/*
functional flow


Stock arrives → Adjust IN
Order placed → Reserve
Order cancelled → Release
Order delivered → Adjust OUT

*/