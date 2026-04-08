import axios from "axios";

// Toma la URL de las variables de entorno de Vite (.env) o usa localhost
const baseURL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor para atrapar errores comunes del backend
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // El servidor respondió con un status fuera del rango 2xx (ej: 404, 422)
      console.error(`[API Error] ${error.response.status}:`, error.response.data);
    } else if (error.request) {
      // La petición se hizo pero no hubo respuesta (backend apagado)
      console.error("[API Error] No hay respuesta del servidor (Backend apagado o CORS)");
    }
    return Promise.reject(error);
  }
);