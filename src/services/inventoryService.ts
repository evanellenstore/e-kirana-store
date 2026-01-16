import api from "./api";

export interface InventoryStatus {
  productId: number;
  availableQty: number;
  reservedQty: number;
}

// GET inventory by product ID
export const getInventory = (productId: number) =>
  api.get<InventoryStatus>(`/inventory/${productId}`);

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

// RESERVE inventory
export const reserveInventory = (
  productId: number,
  quantity: number,
  referenceId: string
) =>
  api.put(`/inventory/${productId}/reserve`, {
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