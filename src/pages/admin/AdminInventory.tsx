import React, { useState } from "react";
import AdminHeader from "../../components/AdminHeader";
import InventoryEntry from "./AdminInventoryEntry";
import InventoryList from "./AdminInventoryList";
import InventoryEdit from "./AdminInventoryEdit";
import AdminInventoryRelease from "./AdminInventoryRelease";
import "./AdminInventory.css";

type ViewMode = "LIST" | "ADD" | "EDIT" | "RELEASE";

const AdminInventory: React.FC = () => {
  const [view, setView] = useState<ViewMode>("LIST");

  return (
    <div className="admin-inventory-container">
      <AdminHeader 
        title="Inventory Management" 
        description="Manage stock levels and batch information"
      />

      <div className="inventory-wrapper">
        <div className="inventory-header">
          <div className="header-content">
            <h1 className="page-title">📦 Inventory Management</h1>
            <p className="page-subtitle">Manage stock levels, batches, and expiry dates</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="inventory-tabs">
          <button
            className={`tab-btn ${view === "LIST" ? "active" : ""}`}
            onClick={() => setView("LIST")}
          >
            <span className="tab-icon">👁️</span>
            <span className="tab-label">Inventory Details</span>
          </button>

          <button
            className={`tab-btn ${view === "ADD" ? "active" : ""}`}
            onClick={() => setView("ADD")}
          >
            <span className="tab-icon">➕</span>
            <span className="tab-label">Add Inventory</span>
          </button>

          <button
            className={`tab-btn ${view === "EDIT" ? "active" : ""}`}
            onClick={() => setView("EDIT")}
          >
            <span className="tab-icon">✏️</span>
            <span className="tab-label">Edit Inventory</span>
          </button>

         
        </div>

        {/* Content Area */}
        <div className="inventory-content">
          {view === "LIST" && <InventoryList />}
          {view === "ADD" && <InventoryEntry />}
          {view === "EDIT" && <InventoryEdit />}
        </div>
      </div>
    </div>
  );
};

export default AdminInventory;
