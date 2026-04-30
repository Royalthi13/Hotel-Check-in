import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const TOKEN_KEY  = "lumina_access_token";
const EXPIRY_KEY = "lumina_token_expiry";
// 300 min = mismo valor que ACCESS_TOKEN_EXPIRE_MINUTES del backend
const TOKEN_TTL  = 300 * 60 * 1000;

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : "/api";

// Sin auth — solo para /auth/token
export const api = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

// Con auth — añade Bearer automáticamente
export const apiAuth = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

apiAuth.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

const onResponseError = (error: AxiosError) => {
  if (error.response) {
    const data   = error.response.data as Record<string, unknown> | undefined;
    const detail = data?.detail ?? data?.message ?? `Error ${error.response.status}`;
    return Promise.reject(new Error(String(detail)));
  }
  if (error.request) {
    return Promise.reject(
      new Error("No se pudo conectar con el servidor. Comprueba tu conexión."),
    );
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, onResponseError);
apiAuth.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearToken();
      // Disparamos un evento para que App.tsx navegue con React Router
      // en lugar de forzar recarga total.
      window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
      return Promise.reject(
        new Error("Sesión expirada. Acceda de nuevo mediante su enlace de reserva."),
      );
    }
    return onResponseError(err);
  },
);
// ── Token helpers ─────────────────────────────────────────────────────────────

export const saveToken = (token: string, persistent = false): void => {
  const expiry = String(Date.now() + TOKEN_TTL);
  if (persistent) {
    localStorage.setItem(TOKEN_KEY,  token);
    localStorage.setItem(EXPIRY_KEY, expiry);
  } else {
    sessionStorage.setItem(TOKEN_KEY,  token);
    sessionStorage.setItem(EXPIRY_KEY, expiry);
  }
};

export const clearToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
};

export const getToken = (): string | null => {
  const expiry = Number(
    sessionStorage.getItem(EXPIRY_KEY) ?? localStorage.getItem(EXPIRY_KEY) ?? "0",
  );
  if (expiry && Date.now() > expiry) {
    clearToken();
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
};