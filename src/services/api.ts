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

export default api; // 🚨 MUST be here
