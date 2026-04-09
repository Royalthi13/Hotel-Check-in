 
import axios from "axios";
import type { AxiosError } from "axios";
 
const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "lumina_access_token";
 
export const api = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});
 
export const apiAuth = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 15_000,
});
 
apiAuth.interceptors.request.use((config) => {
  const token =
    sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
 