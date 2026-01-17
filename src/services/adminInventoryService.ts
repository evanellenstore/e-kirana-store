import api from "./api";

export interface InventoryAdjustRequest {
  quantity: number;
  type: "IN" | "OUT";
  remarks: string;
}

export const adjustInventory = (
  productId: number,
  data: InventoryAdjustRequest
) =>
  api.put(`/inventory/${productId}/adjust`, data);
