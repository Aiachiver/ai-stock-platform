import axios from "axios";

// Create React App exposes production variables through REACT_APP_*.
const configuredApiUrl =
  process.env.REACT_APP_API_URL ||
  process.env.VITE_API_URL ||
  "http://127.0.0.1:8000";

export const API_BASE_URL = configuredApiUrl.replace(/\/$/, "");

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { Accept: "application/json" },
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && localStorage.getItem("token")) {
      localStorage.removeItem("token");
      if (typeof window !== "undefined" && window.location) {
        window.location.assign("/login");
      }
    }
    return Promise.reject(error);
  }
);

export default API;
