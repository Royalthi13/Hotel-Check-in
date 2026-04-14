import { apiAuth } from "./axiosInstance";

// CompanionSearch — lo que devuelve GET /companions/booking/{id}
interface CompanionResponse {
  id: number;
  booking_id: number;
  client_id: number;
  client_name: string;
  client_surname: string;
}

// CompanionBase — lo que acepta POST /companions.
// NOTA: el backend solo acepta { booking_id, client_id }.
// El campo "relationship" NO existe en CompanionBase según el OpenAPI.
// El parentesco del menor se persiste en clients.relationship (campo del cliente).
// Por eso en clients.service.ts → toClientPayload incluye g.relacionesConAdultos[0].parentesco
// mapeado al campo "relationship" del cliente.
interface CompanionPayload {
  booking_id:  number;
  client_id:   number;
  // relationship: NO EXISTE en CompanionBase — el backend lo ignora silenciosamente.
  // Se guarda en el campo clients.relationship al crear/actualizar el cliente.
}

// GET /companions/booking/{booking_id}
export async function getCompanionsByBooking(
  bookingId: number,
): Promise<CompanionResponse[]> {
  const { data, status } = await apiAuth.get<CompanionResponse[]>(
    `/companions/booking/${bookingId}`,
    { validateStatus: (s) => s === 200 || s === 204 },
  );
  // 204 = sin acompañantes, respuesta normal
  return status === 204 || !Array.isArray(data) ? [] : data;
}

// POST /companions
export async function createCompanion(
  payload: CompanionPayload,
): Promise<CompanionResponse> {
  const { data } = await apiAuth.post<CompanionResponse>("/companions", {
    booking_id: payload.booking_id,
    client_id:  payload.client_id,
  });
  return data;
}

// DELETE /companions/{companion_id}
export async function deleteCompanion(companionId: number): Promise<void> {
  await apiAuth.delete(`/companions/${companionId}`);
}