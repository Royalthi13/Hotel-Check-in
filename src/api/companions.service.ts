import { apiAuth } from "./axiosInstance";

interface CompanionResponse {
  id: number;
  booking_id: number;
  client_id: number;
  relationship: string | null;
  client: unknown | null;
}

interface CompanionPayload {
  booking_id: number;
  client_id: number;
  relationship?: string;
}

// GET /companions/booking/{booking_id}
export async function getCompanionsByBooking(
  bookingId: number,
): Promise<CompanionResponse[]> {
  const { data } = await apiAuth.get<CompanionResponse[]>(
    `/companions/booking/${bookingId}`,
  );
  return Array.isArray(data) ? data : [];
}

// POST /companions
export async function createCompanion(
  payload: CompanionPayload,
): Promise<CompanionResponse> {
  const { data } = await apiAuth.post<CompanionResponse>("/companions", payload);
  return data;
}

// DELETE /companions/{companion_id}
export async function deleteCompanion(companionId: number): Promise<void> {
  await apiAuth.delete(`/companions/${companionId}`);
}