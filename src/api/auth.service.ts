import { api, saveToken, clearToken, getToken } from "./axiosInstance";

export interface PreCheckinJwtPayload {
  sub: string;
  client_id: number;
  booking_id: number;
  ip: string;
  exp: number;
  scope: string;
}

// Decodifica el payload del JWT sin validar firma (la firma la valida el backend en cada petición)
export function parseTokenPayload(token: string): PreCheckinJwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(atob(parts[1])) as PreCheckinJwtPayload;
  } catch {
    return null;
  }
}
export function getCurrentTokenPayload(): PreCheckinJwtPayload | null {
  const t = getToken();

  if (!t) return null;
  const payload = parseTokenPayload(t);

  // Si el token no tiene los claims esperados (token viejo o corrupto), lo descartamos
  if (
    !payload ||
    typeof payload.booking_id !== "number" ||
    payload.scope !== "pre_checkin"
  ) {
    clearToken();
    return null;
  }
  return payload;
}
// Pide un token de pre-checkin validando access_code + email/phone.
// Lanza Error con `.status` para que la UI distinga 404 (datos malos) de 429 (rate limit).
export async function requestPreCheckinToken(
  accessCode: string,
  email?: string,
  phone?: string,
): Promise<PreCheckinJwtPayload> {
  const body: Record<string, string> = { access_code: accessCode };
  if (email?.trim()) body.email = email.trim();
  if (phone?.trim()) body.phone = phone.trim();
  const { data } = await api.post("/pre-checkin/request-token", body);
  saveToken(data.access_token, false, data.expires_in, accessCode);
  const payload = parseTokenPayload(data.access_token);
  if (!payload) throw new Error("Token inválido");
  return payload;
}

export function logout(): void {
  clearToken();
}