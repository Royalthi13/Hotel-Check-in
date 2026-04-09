
import { getBookingById, updateBookingCheckin }           from "./bookings.service";
import { getClientById, createClient, updateClient }      from "./clients.service";
import { getCompanionsByBooking, createCompanion, deleteCompanion } from "./companions.service";
import type { GuestData, PartialGuestData, Reserva }      from "@/types";
 
export interface CheckinLoadResult {
  reserva:    Reserva;
  knownGuest: GuestData | null;
  clientId:   number | null;
  bookingId:  number;
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
 
  let knownGuest: GuestData | null = null;
  if (clientId) {
    try {
      knownGuest = await getClientById(clientId);
    } catch {
      knownGuest = null;
    }
  }
 
  return { reserva, knownGuest, clientId, bookingId };
}
 
export async function submitCheckin(payload: CheckinSubmitPayload): Promise<void> {
  const { bookingId, clientId, guests, horaLlegada, observaciones } = payload;
  const [mainGuest, ...companionGuests] = guests;
 
  // 1. Titular
  let mainClientId = clientId;
  if (mainGuest) {
    if (mainClientId) {
      await updateClient(mainClientId, mainGuest);
    } else {
      mainClientId = await createClient(mainGuest);
    }
  }
 
  // 2. Acompañantes: borrar existentes y recrear
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch {
    // si falla la limpieza, continuar igualmente
  }
 
  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;
 
    const companionClientId = await createClient(guest);
    const relationship = guest.esMenor
      ? (guest.relacionesConAdultos?.[0]?.parentesco ?? undefined)
      : undefined;
 
    await createCompanion({
      booking_id:   bookingId,
      client_id:    companionClientId,
      relationship,
    });
  }
 
  // 3. Actualizar reserva
  await updateBookingCheckin(bookingId, { horaLlegada, observaciones });
}
 
export async function savePartialCheckin(
  bookingId: number,
  clientId: number | null,
  mainGuest: PartialGuestData
): Promise<number> {
  void bookingId;
  if (clientId) {
    await updateClient(clientId, mainGuest);
    return clientId;
  }
  return createClient(mainGuest);
}