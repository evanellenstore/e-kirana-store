import api from "./api";

export interface Customer {
  id?: string;
  mobileNo?: string;
  walletBalance: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerRequest {
  mobileNo?: string;
  initialWalletAmount?: number;
}

export interface WalletTransaction {
  id?: string;
  customerId: string;
  amount: number;
  type: 'CREDIT' | 'DEBIT';
  description: string;
  createdAt?: string;
}

// Get or create customer
export const getOrCreateCustomer = (mobileNo: string, billingId?: string) =>
  api.post<Customer>(`/users/customers/getOrCreate`, { mobileNo, billingId });

// Get customer by mobile
export const getCustomerByMobile = (mobileNo: string) =>
  api.get<Customer>(`/users/customers/mobile/${mobileNo}`);

// Get customer by ID
export const getCustomerById = (customerId: string) =>
  api.get<Customer>(`/users/customers/${customerId}`);

// Update wallet balance
export const addToWallet = (customerId: string, amount: number, description: string) =>
  api.post<Customer>(`/users/customers/${customerId}/wallet/add`, { amount, description });

// Deduct from wallet
export const deductFromWallet = (customerId: string, amount: number, description: string) =>
  api.post<Customer>(`/users/customers/${customerId}/wallet/deduct`, { amount, description });

// Get wallet transactions
export const getWalletTransactions = (customerId: string) =>
  api.get<WalletTransaction[]>(`/customers/${customerId}/wallet/transactions`);
