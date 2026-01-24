import api from "./api";
export type CartItem = {
  productId: string;
  batchNo: string;
  name: string;
  sku: string;
  price: number;
  qty: number;
  availableQty: number;
  expiryDate: string;
};




export const startBill = (userName: string) =>
  // send as query param because backend expects @RequestParam("userName")
  api.post(`/billings/start`, null, { params: { userName } });

export const getProductBySku = (sku: string) =>
  api.get(`/products/search/sku?sku=${sku}`);

export const getBatches = (productId: string) =>
  api.get(`/inventory/batches?productId=${productId}`);

export const addItem = (billId: string, payload: any) =>
  api.post(`/billings/${billId}/items`, payload);

export const addItemsBatch = (billId: string, payload: any[]) =>
  api.post(`/billings/${billId}/items`, payload);

export const getSummary = (billId: string) =>
  api.get(`/billings/${billId}/summary`);

export const finalizeBill = (billId: string, payload?: any) =>
  // If backend supports payment metadata, send it in the body. Payload is optional.
  api.post(`/billings/${billId}/finalize`, payload);
