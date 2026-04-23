import { apiAuth } from "./axiosInstance";
import type { Reserva } from "@/types";

// BookingSearch: lo que devuelve GET /bookings/{id} y GET /bookings (vista con JOINs)
// BookingInDB (sin JOINs) solo aparece en respuesta de POST/PUT.
export interface BookingSearch {
  id:             number;
  room_id:        number;
  room_name:      string;
  check_in:       string;
  check_out:      string;
  client_id:      number;
  client_name:    string;
  client_surname: string;
  status_id:      number;
  status_name:    string;
  persons:        number;
  notes:          string | null;
  source:         string | null;
  pay_type:       string | null;
  pay_date:       string | null;
  pay_num:        string | null;
  pay_titular:    string | null;
  card_cad:       string | null;
  pre_checking:   boolean;
  communication:  string | null;
  created_at:     string | null;
}

function toReserva(b: BookingSearch): Reserva {
  const msPerDay = 1000 * 60 * 60 * 24;
  const numNoches = Math.round(
    (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / msPerDay,
  );
  return {
    confirmacion:  `#LM-${b.id}`,
    habitacion:    b.room_name,   // ya viene formateado del JOIN
    fechaEntrada:  b.check_in,
    fechaSalida:   b.check_out,
    numHuespedes:  b.persons,
    numNoches,
  };
}

// GET /bookings/{booking_id}
// Paso 1 del flujo: obtener la reserva e identificar si ya hay un cliente asociado.
// FIX: expone `isAlreadyCheckedIn` para que la UI pueda detectar re-visitas.
export async function getBookingById(bookingId: string | number): Promise<{
  reserva:            Reserva;
  clientId:           number | null;
  bookingId:          number;
  raw:                BookingSearch;
  isAlreadyCheckedIn: boolean;
}> {
  const { data } = await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`);
  return {
    reserva:            toReserva(data),
    clientId:           data.client_id ?? null,
    bookingId:          data.id,
    raw:                data,
    isAlreadyCheckedIn: data.pre_checking === true,
  };
}

// GET /bookings — búsqueda por número (tablet)
export async function searchBookingByConfirmation(
  query: string,
): Promise<{ reserva: Reserva; clientId: number | null } | null> {
  // Intento 1: directamente por id numérico
  try {
    const result = await getBookingById(query);
    return { reserva: result.reserva, clientId: result.clientId };
  } catch { /* continuar con búsqueda por lista */ }

  // Intento 2: lista y filtrar
  try {
    const { data } = await apiAuth.get<BookingSearch[]>("/bookings");
    if (!Array.isArray(data) || data.length === 0) return null;
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
// BookingUpdate requiere TODOS los campos — no se puede mandar solo los que cambian.
// arrival_time NO existe como columna → se persiste en notes como "Hora llegada: HH:MM".
// pre_checking se pone a true para marcar el pre-checkin como completado.
//
// FIX: acepta `existingRaw` para evitar el GET redundante cuando ya se tiene
// el raw del booking (cargado al inicio del flujo en loadCheckinData).
export async function updateBookingCheckin(
  bookingId: number,
  payload: { horaLlegada?: string; observaciones?: string },
  existingRaw?: BookingSearch,
): Promise<void> {
  // Si no tenemos el raw, lo obtenemos ahora
  const current = existingRaw
    ?? (await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`)).data;

  // Construir notas: observaciones + hora de llegada al final
  let notasFinales: string | null = payload.observaciones ?? current.notes ?? null;

  if (
    payload.horaLlegada &&
    payload.horaLlegada !== "No especificada" &&
    !payload.horaLlegada.startsWith("No ")
  ) {
    const sufijo = `Hora llegada: ${payload.horaLlegada}`;
    notasFinales = notasFinales ? `${notasFinales}\n${sufijo}` : sufijo;
  }

  await apiAuth.put(`/bookings/${bookingId}`, {
    room_id:      current.room_id,
    check_in:     current.check_in,
    check_out:    current.check_out,
    client_id:    current.client_id,
    status_id:    current.status_id,
    persons:      current.persons,
    notes:        notasFinales,
    source:       current.source,
    pay_type:     current.pay_type,
    pay_date:     current.pay_date,
    pay_num:      current.pay_num,
    pay_titular:  current.pay_titular,
    card_cad:     current.card_cad,
    pre_checking: true,
  });
}