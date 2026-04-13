import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";

const TOKEN_KEY = "lumina_access_token";

// En desarrollo: BASE_URL = "/api" → pasa por el proxy de Vite → sin CORS.
// En producción: BASE_URL = la URL real del backend (variable de entorno).
//
// VITE_API_URL en .env.production debe ser "https://tu-backend.com"
// VITE_API_URL en .env (desarrollo) debe estar vacío o no definido.
const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`   // producción: URL absoluta del backend
  : "/api";                              // desarrollo: proxy de Vite (mismo origen → sin CORS)

// Sin auth — solo para /auth/token
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

// Con auth — añade Bearer token automáticamente
export const apiAuth = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
});

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
      data?.detail ?? data?.message ?? `Error ${error.response.status}`;
    return Promise.reject(new Error(String(detail)));
  }
  if (error.request) {
    return Promise.reject(
      new Error("No se pudo conectar con el servidor. Comprueba tu conexión.")
    );
  }
  return Promise.reject(error);
};

api.interceptors.response.use((r) => r, onResponseError);
apiAuth.interceptors.response.use((r) => r, onResponseError);

export const saveToken = (token: string, persistent = false): void => {
  if (persistent) localStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.setItem(TOKEN_KEY, token);
};

export const clearToken = (): void => {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
};

export const getToken = (): string | null =>
  sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);