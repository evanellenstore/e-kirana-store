import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import RequireAuth from '../auth/RequireAuth';

import AdminDashboard from '../pages/admin/AdminDashboard';
import Reports from '../pages/admin/Reports';
import Users from '../pages/admin/Users';
import FromPurchase from '../pages/admin/FromPurchase';
import AdminProduct from '../pages/admin/AdminProduct';
import AdminInventory from '../pages/admin/AdminInventory';
import AdminCategory from '../pages/admin/AdminCategory';
import AdminBrand from '../pages/admin/AdminBrand';
import AdminRewards from '../pages/admin/AdminRewards';

import ShopkeeperDashboard from '../pages/shopkeeper/ShopkeeperDashboard';
import Products from '../pages/shopkeeper/Products';
import Inventory from '../pages/shopkeeper/Inventory';
import Billing from '../pages/shopkeeper/Billing';
import ShopkeeperRewards from '../pages/shopkeeper/ShopkeeperRewards';

import CustomerDashboard from '../pages/customer/CustomerDashboard';
import ProductList from '../pages/customer/ProductList';
import Cart from '../pages/customer/Cart';
import Orders from '../pages/customer/Orders';
import Rewards from '../pages/customer/Rewards';

import LoginPage from '../pages/LoginPage';

const AppRoutes: React.FC = () => (
  <Routes>
    {/* Default redirect */}
    <Route path="/" element={<Navigate to="/login" replace />} />

    {/* Public */}
    <Route path="/login" element={<LoginPage />} />

    {/* Admin */}
    <Route
      path="/admin"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminDashboard />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/reports"
      element={
        <RequireAuth roles={['ADMIN']}>
          <Reports />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/users"
      element={
        <RequireAuth roles={['ADMIN']}>
          <Users />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/from-purchase"
      element={
        <RequireAuth roles={['ADMIN']}>
          <FromPurchase />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/admin-products"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminProduct />
        </RequireAuth>
      }
    />
      <Route
      path="/admin/admin-inventory"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminInventory />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/categories"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminCategory />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/brands"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminBrand />
        </RequireAuth>
      }
    />
    <Route
      path="/admin/rewards"
      element={
        <RequireAuth roles={['ADMIN']}>
          <AdminRewards />
        </RequireAuth>
      }
    />

    {/* Shopkeeper */}
    <Route
      path="/shopkeeper"
      element={
        <RequireAuth roles={['SHOPKEEPER']}>
          <ShopkeeperDashboard />
        </RequireAuth>
      }
    />
    <Route
      path="/shopkeeper/products"
      element={
        <RequireAuth roles={['SHOPKEEPER']}>
          <Products />
        </RequireAuth>
      }
    />
    <Route
      path="/shopkeeper/inventory"
      element={
        <RequireAuth roles={['SHOPKEEPER']}>
          <Inventory />
        </RequireAuth>
      }
    />
    <Route
      path="/shopkeeper/billing"
      element={
        <RequireAuth roles={['SHOPKEEPER']}>
          <Billing />
        </RequireAuth>
      }
    />
    <Route
      path="/shopkeeper/rewards"
      element={
        <RequireAuth roles={['SHOPKEEPER']}>
          <ShopkeeperRewards />
        </RequireAuth>
      }
    />

    {/* Customer */}
    <Route
      path="/customer"
      element={
        <RequireAuth roles={['CUSTOMER']}>
          <CustomerDashboard />
        </RequireAuth>
      }
    />
    <Route
      path="/customer/products"
      element={
        <RequireAuth roles={['CUSTOMER']}>
          <ProductList />
        </RequireAuth>
      }
    />
    <Route
      path="/customer/cart"
      element={
        <RequireAuth roles={['CUSTOMER']}>
          <Cart />
        </RequireAuth>
      }
    />
    <Route
      path="/customer/orders"
      element={
        <RequireAuth roles={['CUSTOMER']}>
          <Orders />
        </RequireAuth>
      }
    />
    <Route
      path="/customer/rewards"
      element={
        <RequireAuth roles={['CUSTOMER']}>
          <Rewards />
        </RequireAuth>
      }
    />

    {/* Fallback */}
    <Route path="*" element={<h3>Page Not Found</h3>} />
  </Routes>
);

export default AppRoutes;
