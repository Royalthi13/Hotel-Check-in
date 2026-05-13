import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import i18n from "@/i18n";

// ── Claves pre-checkin (huésped) ──────────────────────────────────────────────
const TOKEN_KEY = "lumina_access_token";
const EXPIRY_KEY = "lumina_token_expiry";
const ACCESS_CODE_KEY = "lumina_access_code";
const DEFAULT_TTL = 30 * 60 * 1000; // 30 min

// ── Claves staff / kiosko ─────────────────────────────────────────────────────
const STAFF_TOKEN_KEY = "lumina_staff_token";
const STAFF_EXPIRY_KEY = "lumina_staff_expiry";
const STAFF_TTL = 8 * 60 * 60 * 1000; // 8 horas

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}`
  : "/api";

// ── ÚNICA INSTANCIA PARA TODAS LAS PETICIONES ──
export const api = axios.create({ baseURL: BASE_URL, timeout: 15_000 });

// 1. Interceptor de Petición (Request): Añade el token automáticamente si existe
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStaffToken() ?? getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  return config;
});

// Función auxiliar para formatear los errores visualmente
const parseError = (error: AxiosError) => {
  if (error.response) {
    const data = error.response.data as Record<string, unknown> | undefined;
    const detail =
      data?.detail ?? data?.message ?? `Error ${error.response.status}`;
    const err = new Error(String(detail)) as Error & { status?: number };
    err.status = error.response.status;
    return err;
  }
  if (error.request) {
    return new Error(i18n.t("errors.connection"));
  }
  return error;
};

// 2. Interceptor de Respuesta (Response): Detecta errores globales como el 401
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // Si da 401 (No autorizado) y la URL NO es la de login (para no bloquear intentos fallidos)
    if (
      error.response?.status === 401 &&
      !error.config?.url?.includes("login")
    ) {
      // Caso A: Caducó el Kiosko
      if (getStaffToken()) {
        clearStaffToken();
        window.location.replace("/new");
        return Promise.reject(
          new Error(i18n.t("errors.staff_session_expired")),
        );
      }

      // Caso B: Caducó el Huésped
      if (getToken()) {
        clearToken();
        window.dispatchEvent(new CustomEvent("AUTH_EXPIRED"));
        return Promise.reject(
          new Error(i18n.t("errors.guest_session_expired")),
        );
      }
    }

    // Si es otro error (404, 500...), se procesa con la función auxiliar
    return Promise.reject(parseError(error));
  },
);

// ── Helpers token pre-checkin (huésped) ───────────────────────────────────────
export const saveToken = (
  token: string,
  persistent = false,
  ttlSeconds?: number,
  accessCode?: string,
): void => {
  const ttlMs = ttlSeconds ? ttlSeconds * 1000 : DEFAULT_TTL;
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

// ── Helpers token staff (kiosko / recepción) ──────────────────────────────────
export const saveStaffToken = (token: string): void => {
  localStorage.setItem(STAFF_TOKEN_KEY, token);
  localStorage.setItem(STAFF_EXPIRY_KEY, String(Date.now() + STAFF_TTL));
};

export const clearStaffToken = (): void => {
  localStorage.removeItem(STAFF_TOKEN_KEY);
  localStorage.removeItem(STAFF_EXPIRY_KEY);
};

export const getStaffToken = (): string | null => {
  const expiry = Number(localStorage.getItem(STAFF_EXPIRY_KEY) ?? "0");
  if (expiry && Date.now() > expiry) {
    clearStaffToken();
    return null;
  }
  return localStorage.getItem(STAFF_TOKEN_KEY);
};

/** Devuelve true si hay una sesión de staff activa (para guardas de ruta) */
export const isStaffLoggedIn = (): boolean => !!getStaffToken();
