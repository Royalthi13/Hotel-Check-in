import { api, saveToken, clearToken } from "./axiosInstance";

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
// Hacemos login real con las credenciales de servicio del .env
export async function loginMagicLink(_magicToken: string): Promise<void> {
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