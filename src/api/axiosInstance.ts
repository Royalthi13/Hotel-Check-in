import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import i18next from "i18next";

const TOKEN_KEY = "lumina_access_token";
const EXPIRY_KEY = "lumina_token_expiry";
const ACCESS_CODE_KEY = "lumina_access_code";
// 300 min = mismo valor que ACCESS_TOKEN_EXPIRE_MINUTES del backend
const TOKEN_TTL = 300 * 60 * 1000;

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
    const data = error.response.data as Record<string, unknown> | undefined;
    const detail =
      data?.detail ??
      data?.message ??
      `${i18next.t("errorBoundary.title")} ${error.response.status}`;
    return Promise.reject(new Error(String(detail)));
  }
  if (error.request) {
    // 🌍 Traducción del error de conexión sin hardcodear
    return Promise.reject(new Error(i18next.t("search.error_connection")));
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, onResponseError);

apiAuth.interceptors.response.use(
  (r) => r,
  (err: AxiosError) => {
    if (err.response?.status === 401) {
      clearToken();

      // Disparamos el evento actualizado
      window.dispatchEvent(new CustomEvent("SESSION_EXPIRED"));

      return Promise.reject(new Error(i18next.t("auth.session_expired")));
    }
    return onResponseError(err);
  },
);

// ── Token helpers ─────────────────────────────────────────────────────────────
export const saveToken = (
  token: string,
  persistent = false,
  ttlSeconds?: number,
  accessCode?: string,
): void => {
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : TOKEN_TTL;
  const expiry = String(Date.now() + ttlMs);
  if (persistent) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(EXPIRY_KEY, expiry);
    if (accessCode) localStorage.setItem(ACCESS_CODE_KEY, accessCode);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(EXPIRY_KEY, expiry);
    if (accessCode) sessionStorage.setItem(ACCESS_CODE_KEY, accessCode);
  }
};
export const clearToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRY_KEY);
  sessionStorage.removeItem(ACCESS_CODE_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRY_KEY);
  localStorage.removeItem(ACCESS_CODE_KEY);
};

export const getStoredAccessCode = (): string | null =>
  sessionStorage.getItem(ACCESS_CODE_KEY) ??
  localStorage.getItem(ACCESS_CODE_KEY);

export const getToken = (): string | null => {
  const expiry = Number(
    sessionStorage.getItem(EXPIRY_KEY) ??
      localStorage.getItem(EXPIRY_KEY) ??
      "0",
  );
  if (expiry && Date.now() > expiry) {
    clearToken();
    return null;
  }
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
};

// ── NUEVA LLAMADA AL ENDPOINT ────────────────────────────────────────────────
interface RequestTokenPayload {
  access_code: string;
  email?: string;
  phone?: string;
}

export const requestPreCheckinToken = async (
  payload: RequestTokenPayload,
): Promise<void> => {
  const { data } = await api.post("/pre-checkin/request-token", payload);

  const token = data.token || data.access_token;

  if (token) {
    saveToken(token, false);
  }
};
