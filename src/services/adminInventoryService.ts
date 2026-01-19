import api from "./api";

export interface InventoryAdjustRequest {
  quantity: number;
  type: "IN" | "OUT";
  remarks: string;
  expiryDate?: string | null; // ISO date string or null when not provided
}

export const adjustInventory = (
  productId: number,
  data: InventoryAdjustRequest
) =>
  api.put(`/inventory/${productId}/adjust`, data);
