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
  // FIX: indica si el pre-checkin ya fue completado anteriormente.
  // Útil para mostrar pantalla de "ya registrado" o modo solo lectura.
  isAlreadyCheckedIn: boolean;
}

export interface CheckinSubmitPayload {
  bookingId:     number;
  clientId:      number | null;
  guests:        PartialGuestData[];
  horaLlegada:   string;
  observaciones: string;
}

// ── Carga inicial ─────────────────────────────────────────────────────────────
// Flujo completo:
//   1. GET /bookings/{token}                      → reserva + client_id + raw
//   2. Si hay client_id → GET /clients/{id}       → datos del titular (ALL fields)
//   3. GET /companions/booking/{id}               → acompañantes previos
//   4. Para cada acompañante → GET /clients/{id}  → datos del acompañante
export async function loadCheckinData(token: string): Promise<CheckinLoadResult> {
  // Paso 1: booking
  // FIX: se extrae `raw` para poder releer pre_checking sin un GET adicional
  const { reserva, clientId, bookingId, raw } = await getBookingById(token);

  // Paso 2: titular — si ya existe en la BD se cargan TODOS sus datos
  // para pre-rellenar el wizard completo (nombre, DNI, dirección, etc.)
  let knownGuest: GuestData | null = null;
  if (clientId) {
    try {
      knownGuest = await getClientById(clientId);
    } catch {
      // Cliente referenciado pero no encontrado (edge case)
      knownGuest = null;
    }
  }

  // Paso 3 + 4: acompañantes ya guardados en BD.
  // Se cargan para pre-rellenar el wizard si el usuario vuelve a la misma URL.
  // Promise.allSettled: un fallo individual no rompe la carga del resto.
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
    // Si falla la carga de acompañantes, continuamos sin ellos
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

// ── Submit del pre-checkin ────────────────────────────────────────────────────
// FIX race condition: se crean acompañantes nuevos PRIMERO y solo después se
// borran los anteriores. El orden inverso (borrar → crear) dejaba los datos
// en estado inconsistente si fallaba algo durante la creación.
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

  // 2. Crear acompañantes nuevos PRIMERO
  const newClientIds: number[] = [];
  for (const guest of companionGuests) {
    // Ignorar entradas vacías (guest sin nombre ni documento)
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;
    const id = await createClient(guest);
    newClientIds.push(id);
  }

  // 3. Borrar relaciones de acompañantes anteriores (NO el titular)
  //    Solo después de que todos los nuevos están creados correctamente.
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch {
    // Si falla la limpieza continuamos — duplicados son preferibles a perder datos
  }

  // 4. Crear relaciones (companion links) en paralelo
  await Promise.all(
    newClientIds.map((id) =>
      createCompanion({ booking_id: bookingId, client_id: id }),
    ),
  );

  // 5. Actualizar reserva: notes + hora llegada + pre_checking = true
  //    No pasamos existingRaw aquí porque el booking puede haber cambiado
  //    desde la carga inicial del wizard.
  await updateBookingCheckin(bookingId, { horaLlegada, observaciones });
}

// ── Guardado parcial (solo titular) ──────────────────────────────────────────
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