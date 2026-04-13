import { api, saveToken, clearToken, getToken } from "./axiosInstance";

// Login estándar (staff/admin)
export async function login(
  username: string,
  password: string,
  persistent = false,
): Promise<void> {
  const { data } = await api.post(
    "/auth/token",
    new URLSearchParams({ username, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  saveToken(data.access_token, persistent);
}

export function logout(): void {
  clearToken();
}

// Login mágico: el token de la URL es el booking_id, NO un JWT.
// Hace login real con las credenciales de servicio del .env.
//
// CORRECCIÓN: comprobamos primero si ya hay token válido en storage
// para no hacer una petición de login innecesaria en cada render.
// La Promise no resuelve hasta que saveToken ha guardado el JWT,
// garantizando que la siguiente llamada a apiAuth ya lleva el header.
export async function loginMagicLink(_magicToken: string): Promise<void> {
  // Si ya hay token en sesión, reutilizarlo (evita login redundante)
  const existing = getToken();
  if (existing) return;

  const username = import.meta.env.VITE_SERVICE_USER;
  const password = import.meta.env.VITE_SERVICE_PASS;

  if (!username || !password) {
    throw new Error(
      "Faltan VITE_SERVICE_USER y VITE_SERVICE_PASS en el archivo .env de la raíz del proyecto",
    );
  }

  const { data } = await api.post(
    "/auth/token",
    new URLSearchParams({ username, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  // saveToken es síncrono — cuando esta línea termina, getToken() ya devuelve el JWT
  saveToken(data.access_token, false);
}

export async function loginGuest(
  bookingId: string,
  surname: string,
): Promise<void> {
  const { data } = await api.post("/auth/guest-login", {
    booking_id: bookingId,
    surname,
  });
  saveToken(data.access_token, false);
}