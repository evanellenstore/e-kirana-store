// src/utils/constants.ts

export const ROLES = {
  ADMIN: 'ADMIN',
  SHOPKEEPER: 'SHOPKEEPER',
  CUSTOMER: 'CUSTOMER',
} as const;

// ✅ EXPORT Role TYPE
export type Role = typeof ROLES[keyof typeof ROLES];
