import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = BACKEND_URL ? `${BACKEND_URL.replace(/\/+$/, "")}/api` : "/api";

let _memoryToken = null;
try {
  _memoryToken = typeof localStorage !== "undefined" ? localStorage.getItem("gt_auth_token") : null;
} catch (_) {}

/** Call this after a successful login/session exchange to store the bearer token. */
export function setAuthToken(token) {
  _memoryToken = token;
  if (token) {
    try {
      localStorage.setItem("gt_auth_token", token);
    } catch (_) {}
  } else {
    try {
      localStorage.removeItem("gt_auth_token");
    } catch (_) {}
  }
}

/** Call this on logout to discard the token from memory. */
export function clearAuthToken() {
  _memoryToken = null;
  try {
    localStorage.removeItem("gt_auth_token");
    localStorage.removeItem("gt_auth_user");
  } catch (_) {}
}

const api = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 15000,
});

// Cookie (httpOnly) is the primary auth. This Bearer fallback keeps sessions working
// across serverless environments and cold starts.
api.interceptors.request.use((config) => {
  let token = _memoryToken;
  if (!token && typeof localStorage !== "undefined") {
    try {
      token = localStorage.getItem("gt_auth_token");
    } catch (_) {}
  }
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
