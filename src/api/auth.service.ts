import { api, saveToken, clearToken } from "./axiosInstance";
import type { TokenResponse } from "./api.types";

export async function login(
  username: string,
  password: string,
  persistent = false,
): Promise<void> {
  const { data } = await api.post<TokenResponse>(
    "/auth/token",
    new URLSearchParams({ username, password }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );
  saveToken(data.access_token, persistent);
}

export function logout(): void {
  clearToken();
}
export async function loginGuest(
  bookingId: string,
  surname: string,
): Promise<void> {
  const { data } = await api.post<TokenResponse>("/auth/guest-login", {
    booking_id: bookingId,
    surname,
  });

  saveToken(data.access_token, false);
}
