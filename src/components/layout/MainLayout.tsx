// src/components/layout/MainLayout.tsx
import React from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="d-flex flex-column min-vh-100">
      {/* Navbar */}
      <Navbar />

      {/* Main content area */}
      <main className="flex-grow-1 p-4 bg-light">{children}</main>

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default MainLayout;
