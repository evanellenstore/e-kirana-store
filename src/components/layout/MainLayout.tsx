// src/components/layout/MainLayout.tsx
import React from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import SidebarProvider from "./SidebarContext";

const MainLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="d-flex flex-column min-vh-100">
        {/* Navbar */}
        <Navbar />

        {/* Main content area */}
        <div className="d-flex flex-grow-1">
          <Sidebar />
          <main className="flex-grow-1 p-4 bg-light">{children}</main>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </SidebarProvider>
  );
};

export default MainLayout;
