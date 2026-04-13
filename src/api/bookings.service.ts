import { apiAuth } from "./axiosInstance";
import type { Reserva } from "@/types";

interface RoomType { id: number; name: string; }
interface Room { id: number; room_number: string; room_type: RoomType | null; }
interface BookingResponse {
  id: number;
  confirmation_number: string;
  check_in: string;
  check_out: string;
  num_nights: number;
  num_guests: number;
  client_id: number | null;
  status: string;
  observations: string | null;
  arrival_time: string | null;
  room: Room | null;
}

function toReserva(b: BookingResponse): Reserva {
  const msPerDay = 1000 * 60 * 60 * 24;
  const numNoches =
    b.num_nights ??
    Math.round(
      (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) /
        msPerDay,
    );
  const habitacion =
    b.room?.room_type?.name ??
    (b.room?.room_number ? `Habitación ${b.room.room_number}` : "—");
  return {
    confirmacion: b.confirmation_number ?? `#LM-${b.id}`,
    habitacion,
    fechaEntrada: b.check_in,
    fechaSalida: b.check_out,
    numHuespedes: b.num_guests ?? 1,
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
  try {
    const result = await getBookingById(query);
    return { reserva: result.reserva, clientId: result.clientId };
  } catch {
    // intenta por confirmation_number
  }
  try {
    const { data } = await apiAuth.get<BookingResponse[]>("/bookings", {
      params: { confirmation_number: query },
    });
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