import { getBookingById, updateBookingCheckin }           from "./bookings.service";
import { getClientById, createClient, updateClient }      from "./clients.service";
import { getCompanionsByBooking, createCompanion, deleteCompanion } from "./companions.service";
import type { GuestData, PartialGuestData, Reserva }      from "@/types";

export interface CheckinLoadResult {
  reserva:     Reserva;
  knownGuest:  GuestData | null;
  clientId:    number | null;
  bookingId:   number;
  // FIX: los acompañantes ya guardados en la BD se cargan aquí para
  // pre-rellenar el wizard si el usuario vuelve a la misma URL.
  companions:  GuestData[];
}

export interface CheckinSubmitPayload {
  bookingId:     number;
  clientId:      number | null;
  guests:        PartialGuestData[];
  horaLlegada:   string;
  observaciones: string;
}

export async function loadCheckinData(token: string): Promise<CheckinLoadResult> {
  const { reserva, clientId, bookingId } = await getBookingById(token);

  // 1. Titular
  let knownGuest: GuestData | null = null;
  if (clientId) {
    try {
      knownGuest = await getClientById(clientId);
    } catch {
      knownGuest = null;
    }
  }

  // 2. Acompañantes — si ya se rellenaron en un envío previo los recuperamos
  //    para pre-rellenar el wizard cuando el usuario vuelve a la misma URL.
  let companions: GuestData[] = [];
  try {
    const companionList = await getCompanionsByBooking(bookingId);
    if (companionList.length > 0) {
      const results = await Promise.all(
        companionList.map(async (c) => {
          try {
            return await getClientById(c.client_id);
          } catch {
            return null;
          }
        }),
      );
      companions = results.filter((g): g is GuestData => g !== null);
    }
  } catch {
    // Si falla la carga de acompañantes continuamos sin ellos
    companions = [];
  }

  return { reserva, knownGuest, clientId, bookingId, companions };
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

  // 2. Acompañantes: borrar existentes y recrear con datos frescos.
  // El parentesco del menor va en clients.relationship, no en companions.
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch {
    // Si falla la limpieza, continuar igualmente
  }

  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;

    const companionClientId = await createClient(guest);
    await createCompanion({
      booking_id: bookingId,
      client_id:  companionClientId,
    });
  }

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