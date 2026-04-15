import { apiAuth } from "./axiosInstance";
import type { Reserva } from "@/types";

// Schema REAL que devuelve GET /bookings/{id} y GET /bookings → es BookingSearch, NO BookingInDB.
// BookingInDB solo lo devuelve POST/PUT. BookingSearch es la vista enriquecida con JOINs.
interface BookingSearch {
  id: number;
  room_id: number;
  room_name: string;          // ← nombre de habitación ya formateado por el backend
  check_in: string;
  check_out: string;
  client_id: number;
  client_name: string;
  client_surname: string;
  status_id: number;
  status_name: string;
  persons: number;
  notes: string | null;
  source: string | null;
  pay_type: string | null;
  pay_date: string | null;
  pay_num: string | null;
  pay_titular: string | null;
  card_cad: string | null;
  pre_checking: boolean;
  communication: string | null;
  created_at: string | null;
}

function toReserva(b: BookingSearch): Reserva {
  const msPerDay = 1000 * 60 * 60 * 24;
  const numNoches = Math.round(
    (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / msPerDay,
  );
  return {
    confirmacion: `#LM-${b.id}`,
    habitacion: b.room_name,  // ← usar room_name directamente, ya viene formateado del JOIN
    fechaEntrada: b.check_in,
    fechaSalida: b.check_out,
    numHuespedes: b.persons,
    numNoches,
  };
}

// GET /bookings/{booking_id} — devuelve BookingSearch
export async function getBookingById(bookingId: string | number): Promise<{
  reserva: Reserva;
  clientId: number | null;
  bookingId: number;
  raw: BookingSearch;          // ← guardamos el raw para el PUT posterior
}> {
  const { data } = await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`);
  return {
    reserva: toReserva(data),
    clientId: data.client_id ?? null,
    bookingId: data.id,
    raw: data,
  };
}

// GET /bookings — búsqueda por número (tablet)
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
  // Fallback: lista sin filtro de fecha (devuelve las más recientes)
  try {
    const { data } = await apiAuth.get<BookingSearch[]>("/bookings");
    if (!Array.isArray(data) || data.length === 0) return null;
    // Buscar por id coincidente si query es numérico
    const numId = parseInt(query, 10);
    const match = isNaN(numId)
      ? data[0]
      : (data.find((b) => b.id === numId) ?? data[0]);
    if (!match) return null;
    return { reserva: toReserva(match), clientId: match.client_id ?? null };
  } catch {
    return null;
  }
}

// PUT /bookings/{booking_id}
// CRÍTICO: BookingUpdate requiere TODOS los campos (room_id, check_in, check_out,
// client_id, status_id, persons) como obligatorios. El frontend no puede mandar
// solo observations/arrival_time — necesitamos el estado actual del booking primero.
//
// arrival_time NO existe como columna en la BD — se persiste en notes como
// "Hora llegada: HH:MM" al final de las observaciones.
//
// pre_checking se pone a true para marcar que el pre-checkin fue completado.
export async function updateBookingCheckin(
  bookingId: number,
  payload: { horaLlegada?: string; observaciones?: string },
): Promise<void> {
  if (!payload.horaLlegada && !payload.observaciones) return;

  // 1. Obtener el estado actual del booking para no perder ningún campo
  const { data: current } = await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`);

  // 2. Construir notas: observaciones del usuario + hora de llegada al final
  let notasFinales: string | null = payload.observaciones ?? current.notes ?? null;

  if (
    payload.horaLlegada &&
    payload.horaLlegada !== "No especificada" &&
    !payload.horaLlegada.startsWith("No ")
  ) {
    const sufijo = `Hora llegada: ${payload.horaLlegada}`;
    notasFinales = notasFinales
      ? `${notasFinales}\n${sufijo}`
      : sufijo;
  }

  // 3. PUT con todos los campos requeridos
  const body = {
    room_id:     current.room_id,
    check_in:    current.check_in,
    check_out:   current.check_out,
    client_id:   current.client_id,
    status_id:   current.status_id,
    persons:     current.persons,
    notes:       notasFinales,
    source:      current.source,
    pay_type:    current.pay_type,
    pay_date:    current.pay_date,
    pay_num:     current.pay_num,
    pay_titular: current.pay_titular,
    card_cad:    current.card_cad,
    pre_checking: true,  // ← marcar pre-checkin como completado
  };

  await apiAuth.put(`/bookings/${bookingId}`, body);
}