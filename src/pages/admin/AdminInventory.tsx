import React, { useState } from "react";
import { Container, Button, Card } from "react-bootstrap";
import InventoryEntry from "./AdminInventoryEntry";
import InventoryList from "./AdminInventoryList";

type ViewMode = "LIST" | "ADD";

const AdminInventory: React.FC = () => {
  const [view, setView] = useState<ViewMode>("LIST");

  return (
    <Container className="mt-4" style={{ maxWidth: 900 }}>
      {/* HEADER */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h4>📦 Admin Inventory</h4>

        <div className="d-flex gap-2">
          <Button
            variant={view === "LIST" ? "primary" : "outline-primary"}
            onClick={() => setView("LIST")}
          >
            Inventory Details
          </Button>

          <Button
            variant={view === "ADD" ? "success" : "outline-success"}
            onClick={() => setView("ADD")}
          >
            ➕ Add Inventory
          </Button>
        </div>
      </div>

      {/* CONTENT */}
      <Card className="shadow" style={{ minHeight: 620 }}>
        <Card.Body>
          {view === "LIST" && <InventoryList />}
          {view === "ADD" && <InventoryEntry />}
        </Card.Body>
      </Card>
    </Container>
  );
};

export default AdminInventory;
