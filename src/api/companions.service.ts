import { api } from "./axiosInstance";

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
  const { data, status } = await api.get<CompanionResponse[]>(
    `/companions/booking/${bookingId}`,
    { validateStatus: (s) => s === 200 || s === 204 },
  );

  if (status === 204) return [];
  return Array.isArray(data) ? data : [];
}

// POST /companions
export async function createCompanion(
  payload: CompanionPayload,
): Promise<void> {
  await api.post("/companions", payload);
}
