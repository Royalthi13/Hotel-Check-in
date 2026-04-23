import { apiAuth } from "./axiosInstance";

export interface CompanionResponse {
  id: number;
  booking_id: number;
  client_id: number;
  parentesco: string | null;
}

export interface CompanionPayload {
  booking_id: number;
  client_id: number;
  parentesco?: string | null;
}

// GET /companions/booking/{id}
export async function getCompanionsByBooking(
  bookingId: number,
): Promise<CompanionResponse[]> {
  const { data } = await apiAuth.get<CompanionResponse[]>(
    `/companions/booking/${bookingId}`,
  );
  return data;
}

// POST /companions
export async function createCompanion(
  payload: CompanionPayload,
): Promise<void> {
  await apiAuth.post("/companions", payload);
}

// DELETE /companions/{id}
export async function deleteCompanion(id: number): Promise<void> {
  await apiAuth.delete(`/companions/${id}`);
}
