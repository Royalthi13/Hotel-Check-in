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
  contactoInput: string,
): Promise<{
  reserva: Reserva;
  clientId: number | null;
  bookingId: number;
} | null> {
  let resultEncontrado: Awaited<ReturnType<typeof getBookingById>> | null =
    null;
  try {
    resultEncontrado = await getBookingById(query);
  } catch (e) {
    if (import.meta.env.DEV) console.warn("Error en búsqueda directa:", e);
    return null;
  }

  if (!resultEncontrado || !resultEncontrado.reserva) return null;

  // Validación mínima: el staff debe introducir email o teléfono del titular
  // para evitar que cualquiera abra cualquier reserva con solo el ID.
  const contactoLimpio = contactoInput.trim().toLowerCase();
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactoLimpio);
  const isPhone = /^\+?[\d\s-]{9,15}$/.test(contactoLimpio);

  if (!isEmail && !isPhone) return null;

  return {
    reserva: resultEncontrado.reserva,
    clientId: resultEncontrado.clientId,
    bookingId: resultEncontrado.bookingId,
  };
}
