import { api } from "./axiosInstance";
import { Reserva } from "../types";

export const getBookingById = async (bookingId: string): Promise<Reserva> => {
  const { data } = await api.get<Reserva>(`/bookings/${bookingId}`);
  return data;
};

export const createBooking = async (
  bookingData: Omit<Reserva, "id">,
): Promise<Reserva> => {
  const { data } = await api.post<Reserva>("/bookings", bookingData);
  return data;
};

export const updateBooking = async (
  bookingId: string,
  updateData: Partial<Reserva>,
): Promise<Reserva> => {
  const { data } = await api.patch<Reserva>(
    `/bookings/${bookingId}`,
    updateData,
  );
  return data;
};
