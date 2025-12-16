import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL;

export const FRONTEND_MODE =
  import.meta.env.VITE_FRONTEND_MODE || "dev";

// -----------------------------
// AXIOS INSTANCE
// -----------------------------
export const api = axios.create({
  baseURL: `${API_BASE_URL}/api/v1`,
  withCredentials: true, 
  // prod - send cookies
  // dev - do NOT send cookies
});

// -----------------------------
// GLOBAL 401 HANDLER
// -----------------------------
let isRefreshing = false;
let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/users/auth/refresh")
    ) {
      originalRequest._retry = true;

      try {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshPromise = api.post("/users/auth/refresh");
        }

        await refreshPromise;
        isRefreshing = false;

        return api(originalRequest); // retry original request
      } catch (refreshError) {
        isRefreshing = false;
        window.dispatchEvent(new Event("auth-logout"));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

