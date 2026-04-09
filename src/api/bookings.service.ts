
import { api } from "./axiosInstance";
import type { BookingResponse, BookingUpdatePayload } from "./api.types";
import type { Reserva } from "@/types";
 
function toReserva(b: BookingResponse): Reserva {
  const msPerDay  = 1000 * 60 * 60 * 24;
  const checkIn   = new Date(b.check_in);
  const checkOut  = new Date(b.check_out);
  const numNoches =
    b.num_nights ??
    Math.round((checkOut.getTime() - checkIn.getTime()) / msPerDay);
 
  const habitacion =
    b.room?.room_type?.name ??
    (b.room?.room_number ? `Habitación ${b.room.room_number}` : "—");
 
  return {
    confirmacion: b.confirmation_number ?? `#LM-${b.id}`,
    habitacion,
    fechaEntrada: b.check_in,
    fechaSalida:  b.check_out,
    numHuespedes: b.num_guests ?? 1,
    numNoches,
  };
}
 
export async function getBookingById(bookingId: string | number): Promise<{
  reserva:   Reserva;
  clientId:  number | null;
  bookingId: number;
}> {
  const { data } = await api.get<BookingResponse>(`/bookings/${bookingId}`);
  return {
    reserva:   toReserva(data),
    clientId:  data.client_id ?? null,
    bookingId: data.id,
  };
}
 
export async function searchBookingByConfirmation(
  query: string
): Promise<{ reserva: Reserva; clientId: number | null } | null> {
  try {
    const result = await getBookingById(query);
    return { reserva: result.reserva, clientId: result.clientId };
  } catch {
    // no encontrado por ID, intentar por confirmation_number
  }
 
  try {
    const { data } = await api.get<BookingResponse[]>("/bookings", {
      params: { confirmation_number: query },
    });
    const match = Array.isArray(data) ? data[0] : null;
    if (!match) return null;
    return {
      reserva:  toReserva(match),
      clientId: match.client_id ?? null,
    };
  } catch {
    return null;
  }
}
 
export async function updateBookingCheckin(
  bookingId: number,
  payload: { horaLlegada?: string; observaciones?: string }
): Promise<void> {
  const body: BookingUpdatePayload = {};
  if (payload.horaLlegada)   body.arrival_time  = payload.horaLlegada;
  if (payload.observaciones) body.observations  = payload.observaciones;
  if (Object.keys(body).length === 0) return;
  await api.put(`/bookings/${bookingId}`, body);
}