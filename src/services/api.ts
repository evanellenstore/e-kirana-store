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
      console.warn("🔐 Token expired or invalid - redirecting to login");
      localStorage.removeItem("user");
      alert("⚠️ Your session has expired. Please login again.");
      // Redirect after a short delay to allow alert to be read
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
    return Promise.reject(error);
  }
);

export default api; // 🚨 MUST be here

