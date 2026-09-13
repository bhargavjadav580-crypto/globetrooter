import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
export const API = BACKEND_URL ? `${BACKEND_URL.replace(/\/+$/, "")}/api` : "/api";

// In-memory token — NOT localStorage. localStorage is readable by any XSS script.
// This variable lives only in JS memory and is cleared on page refresh.
// The httpOnly cookie (set by the server) is the primary persistent auth mechanism.
let _memoryToken = null;

/** Call this after a successful login/session exchange to store the bearer token. */
export function setAuthToken(token) {
  _memoryToken = token;
}

/** Call this on logout to discard the token from memory. */
export function clearAuthToken() {
  _memoryToken = null;
}

const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Cookie (httpOnly) is the primary auth. This Bearer fallback keeps sessions working
// when third-party cookies are blocked and makes automated flows deterministic.
api.interceptors.request.use((config) => {
  if (_memoryToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${_memoryToken}`;
  }
  return config;
});

export default api;
