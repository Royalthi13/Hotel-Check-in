import { apiAuth } from "./axiosInstance";
import type { Reserva } from "@/types";

export interface BookingSearch {
  id: number;
  room_id: number;
  room_name: string;
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
    (new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) /
      msPerDay,
  );
  return {
    confirmacion: `#LM-${b.id}`,
    habitacion: b.room_name,
    fechaEntrada: b.check_in,
    fechaSalida: b.check_out,
    numHuespedes: b.persons,
    numNoches,
  };
}

export async function getBookingById(bookingId: string | number): Promise<{
  reserva: Reserva;
  clientId: number | null;
  bookingId: number;
  raw: BookingSearch;
  isAlreadyCheckedIn: boolean;
}> {
  const { data } = await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`);
  return {
    reserva: toReserva(data),
    clientId: data.client_id ?? null,
    bookingId: data.id,
    raw: data,
    isAlreadyCheckedIn: data.pre_checking === true,
  };
}

export async function searchBookingByConfirmation(
  query: string,
  apellidoInput: string,
): Promise<{ reserva: Reserva; clientId: number | null } | null> {
  let resultEncontrado: Awaited<ReturnType<typeof getBookingById>> | null =
    null;
  try {
    resultEncontrado = await getBookingById(query);
  } catch (e) {
    console.warn("Error en búsqueda directa:", e);
  }

  if (!resultEncontrado || !resultEncontrado.reserva) return null;

  const apellidoLimpio = apellidoInput.trim().toLowerCase();
  const apellidoReserva = (resultEncontrado.raw.client_surname || "")
    .trim()
    .toLowerCase();

  if (
    apellidoReserva.includes(apellidoLimpio) ||
    apellidoLimpio.includes(apellidoReserva)
  ) {
    return {
      reserva: resultEncontrado.reserva,
      clientId: resultEncontrado.clientId,
    };
  }
  return null;
}

/**
 * ACTUALIZACIÓN: Ahora acepta clientId en el payload para vinculación explícita
 */
export async function updateBookingCheckin(
  bookingId: number,
  payload: {
    horaLlegada?: string;
    observaciones?: string;
    clientId?: number | null;
  },
  existingRaw?: BookingSearch,
): Promise<void> {
  const current =
    existingRaw ??
    (await apiAuth.get<BookingSearch>(`/bookings/${bookingId}`)).data;

  let notasFinales: string | null =
    payload.observaciones ?? current.notes ?? null;

  if (
    payload.horaLlegada &&
    payload.horaLlegada !== "No especificada" &&
    !payload.horaLlegada.startsWith("No ")
  ) {
    const sufijo = `Hora llegada: ${payload.horaLlegada}`;
    notasFinales = notasFinales ? `${notasFinales}\n${sufijo}` : sufijo;
  }

  await apiAuth.put(`/bookings/${bookingId}`, {
    room_id: current.room_id,
    check_in: current.check_in,
    check_out: current.check_out,
    // 👇 VINCULACIÓN EXPLÍCITA: Si viene en el payload, usamos ese, si no, el que tenía.
    client_id:
      payload.clientId !== undefined ? payload.clientId : current.client_id,
    status_id: current.status_id,
    persons: current.persons,
    notes: notasFinales,
    source: current.source,
    pay_type: current.pay_type,
    pay_date: current.pay_date,
    pay_num: current.pay_num,
    pay_titular: current.pay_titular,
    card_cad: current.card_cad,
    pre_checking: true,
  });
}
