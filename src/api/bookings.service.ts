import { apiAuth } from "./axiosInstance";
import type { Reserva } from "@/types";

// Schema real de la BD: sin confirmation_number, sin room anidado, sin num_guests/num_nights.
// Los campos reales son: id, room_id, check_in, check_out, client_id, status_id,
// persons, notes, source, pay_type, pay_date, pay_num, pay_titular.
interface BookingResponse {
  id: number;
  room_id: number | null;
  check_in: string;
  check_out: string;
  client_id: number | null;
  status_id: number | null;
  persons: number | null;
  notes: string | null;
  source: string | null;
  pay_type: string | null;
  pay_date: string | null;
  pay_num: string | null;
  pay_titular: string | null;
}

function toReserva(b: BookingResponse): Reserva {
  const msPerDay = 1000 * 60 * 60 * 24;
  const numNoches = Math.round(
    (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) /
      msPerDay,
  );
  return {
    confirmacion: `#LM-${b.id}`,
    habitacion: b.room_id ? `Habitación ${b.room_id}` : "—",
    fechaEntrada: b.check_in,
    fechaSalida: b.check_out,
    numHuespedes: b.persons ?? 1,
    numNoches,
  };
}

// GET /bookings/{booking_id}
export async function getBookingById(bookingId: string | number): Promise<{
  reserva: Reserva;
  clientId: number | null;
  bookingId: number;
}> {
  const { data } = await apiAuth.get<BookingResponse>(`/bookings/${bookingId}`);
  return {
    reserva: toReserva(data),
    clientId: data.client_id ?? null,
    bookingId: data.id,
  };
}

// GET /bookings?confirmation_number=XXX
export async function searchBookingByConfirmation(
  query: string,
): Promise<{ reserva: Reserva; clientId: number | null } | null> {
  // Intenta primero por id numérico
  try {
    const result = await getBookingById(query);
    return { reserva: result.reserva, clientId: result.clientId };
  } catch {
    // continuar con búsqueda por lista
  }
  // Fallback: lista filtrada
  try {
    const { data } = await apiAuth.get<BookingResponse[]>("/bookings");
    const match = Array.isArray(data) ? data[0] : null;
    if (!match) return null;
    return { reserva: toReserva(match), clientId: match.client_id ?? null };
  } catch {
    return null;
  }
}

// PUT /bookings/{booking_id}
export async function updateBookingCheckin(
  bookingId: number,
  payload: { horaLlegada?: string; observaciones?: string },
): Promise<void> {
  const body: Record<string, string> = {};
  if (payload.horaLlegada) body.arrival_time = payload.horaLlegada;
  if (payload.observaciones) body.observations = payload.observaciones;
  if (Object.keys(body).length === 0) return;
  await apiAuth.put(`/bookings/${bookingId}`, body);
}