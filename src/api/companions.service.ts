import { api } from "./axiosInstance";
import type { CompanionResponse, CompanionPayload } from "./api.types";
 
export async function getCompanionsByBooking(
  bookingId: number
): Promise<CompanionResponse[]> {
  const { data } = await api.get<CompanionResponse[]>(
    `/companions/booking/${bookingId}`
  );
  return Array.isArray(data) ? data : [];
}
 
export async function createCompanion(
  payload: CompanionPayload
): Promise<CompanionResponse> {
  const { data } = await api.post<CompanionResponse>("/companions", payload);
  return data;
}
 
export async function deleteCompanion(companionId: number): Promise<void> {
  await api.delete(`/companions/${companionId}`);
}
 
 