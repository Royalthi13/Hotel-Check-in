import { getBookingById, updateBookingCheckin }                     from "./bookings.service";
import { getClientById, createClient, updateClient }                from "./clients.service";
import { getCompanionsByBooking, createCompanion, deleteCompanion } from "./companions.service";
import type { GuestData, PartialGuestData, Reserva }                from "@/types";

export interface CheckinLoadResult {
  reserva:            Reserva;
  knownGuest:         GuestData | null;
  clientId:           number | null;
  bookingId:          number;
  companions:         GuestData[];
  isAlreadyCheckedIn: boolean;
}

export interface CheckinSubmitPayload {
  bookingId:     number;
  clientId:      number | null;
  guests:        PartialGuestData[];
  horaLlegada:   string;
  observaciones: string;
}

export async function loadCheckinData(token: string): Promise<CheckinLoadResult> {
  const { reserva, clientId, bookingId, raw } = await getBookingById(token);

  // 1. Titular
  let knownGuest: GuestData | null = null;
  if (clientId) {
    try {
      knownGuest = await getClientById(clientId);
    } catch {
      knownGuest = null;
    }
  }

  // 2. Acompañantes ya guardados — pre-rellenan el wizard si el usuario
  //    vuelve a la misma URL después de haber enviado el pre-checkin.
  //    Usamos Promise.allSettled para que un fallo individual no rompa la carga.
  let companions: GuestData[] = [];
  try {
    const companionList = await getCompanionsByBooking(bookingId);
    if (companionList.length > 0) {
      const results = await Promise.allSettled(
        companionList.map((c) => getClientById(c.client_id)),
      );
      companions = results
        .filter((r): r is PromiseFulfilledResult<GuestData> => r.status === "fulfilled")
        .map((r) => r.value);
    }
  } catch {
    companions = [];
  }

  return {
    reserva,
    knownGuest,
    clientId,
    bookingId,
    companions,
    isAlreadyCheckedIn: raw.pre_checking === true,
  };
}

export async function submitCheckin(payload: CheckinSubmitPayload): Promise<void> {
  const { bookingId, clientId, guests, horaLlegada, observaciones } = payload;
  const [mainGuest, ...companionGuests] = guests;

  // 1. Titular: actualizar si ya existía, crear si es nuevo
  let mainClientId = clientId;
  if (mainGuest) {
    if (mainClientId) {
      await updateClient(mainClientId, mainGuest);
    } else {
      mainClientId = await createClient(mainGuest);
    }
  }

  // 2. FIX race condition: CREAR acompañantes PRIMERO, luego borrar los viejos.
  //    El orden anterior (borrar → crear) dejaba los datos en estado inconsistente
  //    si fallaba algo entre el borrado y la recreación.
  const newClientIds: number[] = [];
  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;
    const id = await createClient(guest);
    newClientIds.push(id);
  }

  // Borrar relaciones de acompañantes anteriores (NO el cliente titular)
  try {
    const existing  = await getCompanionsByBooking(bookingId);
    const toDelete  = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch {
    // Si falla la limpieza de antiguos continuamos — los duplicados son
    // preferibles a perder los datos recién creados.
  }

  // Crear las nuevas relaciones en paralelo
  await Promise.all(
    newClientIds.map((id) =>
      createCompanion({ booking_id: bookingId, client_id: id }),
    ),
  );

  // 3. Actualizar reserva: notas + hora llegada + pre_checking=true
  await updateBookingCheckin(bookingId, { horaLlegada, observaciones });
}

export async function savePartialCheckin(
  bookingId: number,
  clientId: number | null,
  mainGuest: PartialGuestData,
): Promise<number> {
  void bookingId; // TODO: PATCH /bookings/{id}/client cuando el backend lo exponga
  if (clientId) {
    await updateClient(clientId, mainGuest);
    return clientId;
  }
  return createClient(mainGuest);
}