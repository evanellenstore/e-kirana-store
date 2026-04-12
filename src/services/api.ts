import axios from "axios";
import { API_BASE } from "../config/apiConfig";

const api = axios.create({
  baseURL: API_BASE.BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const storedUser = localStorage.getItem("user");
  if (storedUser) {
    const token = JSON.parse(storedUser).token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor to handle 401 (token expired)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      console.warn("🔐 Token expired or invalid");
      
      // Only redirect if we're not already on the login page
      if (window.location.pathname !== "/login") {
        localStorage.removeItem("user");
        // Use a more graceful redirect with a small delay
        setTimeout(() => {
          window.location.href = "/login?expired=true";
        }, 100);
      }
    }
    return Promise.reject(error);
  }
);

export default api; // 🚨 MUST be here

