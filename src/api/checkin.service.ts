import { getBookingById, updateBookingCheckin } from "./bookings.service";
import { getClientById, createClient, updateClient } from "./clients.service";
import {
  getCompanionsByBooking,
  createCompanion,
  deleteCompanion,
} from "./companions.service";
import type { GuestData, PartialGuestData, Reserva } from "@/types";
import { getRelationships } from "./catalogs.service";

export interface CheckinLoadResult {
  reserva: Reserva;
  knownGuest: GuestData | null;
  clientId: number | null;
  bookingId: number;
  companions: GuestData[];
  isAlreadyCheckedIn: boolean;
}

export interface CheckinSubmitPayload {
  bookingId: number;
  clientId: number | null;
  guests: PartialGuestData[];
  horaLlegada: string;
  observaciones: string;
}

// ── Carga inicial de datos ───────────────────────────────────────────────────
export async function loadCheckinData(
  token: string,
): Promise<CheckinLoadResult> {
  const { reserva, clientId, bookingId, raw } = await getBookingById(token);

  let knownGuest: GuestData | null = null;
  if (clientId) {
    try {
      knownGuest = await getClientById(clientId);
    } catch (e) {
      console.warn("No se pudo cargar el huésped:", e);
      knownGuest = null;
    }
  }

  let companions: GuestData[] = [];
  try {
    const companionList = await getCompanionsByBooking(bookingId);
    if (companionList.length > 0) {
      const results = await Promise.allSettled(
        companionList.map((c) => getClientById(c.client_id)),
      );
      companions = results
        .filter(
          (r): r is PromiseFulfilledResult<GuestData> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);
    }
  } catch (e) {
    console.warn("Error cargando acompañantes:", e);
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

// ── Envío final del Check-in ─────────────────────────────────────────────────
export async function submitCheckin(
  payload: CheckinSubmitPayload,
): Promise<void> {
  const { bookingId, clientId, guests, horaLlegada, observaciones } = payload;
  const catalogo = await getRelationships();

  type GuestForAPI = PartialGuestData & { parentescoParaAPI?: string };
  const finalGuests: GuestForAPI[] = [...guests];

  // 1. 🛡️ GESTIÓN DE PARENTESCOS (Evita sobrescritura si hay varios menores)
  finalGuests.forEach((guest, index) => {
    if (guest.esMenor && guest.relacionesConAdultos?.length) {
      const rel = guest.relacionesConAdultos[0];
      const adultoIndex = rel.adultoIndex;
      const codigoSeleccionado = rel.parentesco;

      const adulto = finalGuests[adultoIndex];
      if (adulto) {
        // Solo asignamos código al adulto si aún NO tiene uno.
        // Evitamos que el segundo hijo sobrescriba lo que puso el primero.
        if (!adulto.parentescoParaAPI) {
          adulto.parentescoParaAPI = codigoSeleccionado;
        }

        // El menor siempre recibe su código inverso (ej: "HJ" para Hijo)
        const relacionInfo = catalogo.find(
          (r) => r.codrelation === codigoSeleccionado,
        );
        if (relacionInfo?.linked_relation) {
          finalGuests[index].parentescoParaAPI = relacionInfo.linked_relation;
        }
      }
    }
  });

  // 2. HERENCIA DE DIRECCIÓN PARA MENORES (Incluye codCity)
  const CODIGOS_PROGENITOR = new Set(["PM", "TU"]);
  finalGuests.forEach((guest, index) => {
    if (!guest.esMenor || guest.direccion?.trim()) return;

    const rel = guest.relacionesConAdultos?.[0];
    if (!rel) return;

    const adulto = finalGuests[rel.adultoIndex];
    if (!adulto || adulto.esMenor) return;

    // Usamos el código asignado en el paso anterior o el directo de la relación
    const codAdulto = adulto.parentescoParaAPI ?? rel.parentesco;
    if (!CODIGOS_PROGENITOR.has(codAdulto)) return;

    finalGuests[index] = {
      ...guest,
      direccion: adulto.direccion,
      ciudad: adulto.ciudad,
      codCity: adulto.codCity,
      provincia: adulto.provincia,
      cp: adulto.cp,
      pais: adulto.pais,
    };
  });

  const [mainGuest, ...companionGuests] = finalGuests;

  // 3. PROCESAR TITULAR (Crear o Actualizar)
  let mainClientId = clientId;
  if (mainGuest) {
    if (mainClientId) {
      await updateClient(mainClientId, mainGuest);
    } else {
      mainClientId = await createClient(mainGuest);
    }
  }

  // 4. PROCESAR ACOMPAÑANTES
  const newClientIds: number[] = [];
  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;
    if (guest.id) {
      await updateClient(guest.id, guest);
      newClientIds.push(guest.id);
    } else {
      const id = await createClient(guest);
      newClientIds.push(id);
    }
  }

  // 5. LIMPIEZA DE COMPANIONS ANTIGUOS
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch (e) {
    console.warn("Error limpiando antiguos:", e);
  }

  // 6. VINCULAR NUEVOS ACOMPAÑANTES
  await Promise.all(
    newClientIds.map((id) =>
      createCompanion({ booking_id: bookingId, client_id: id }),
    ),
  );

  // 7. FINALIZAR RESERVA (Con vinculación de clientId)
  await updateBookingCheckin(bookingId, {
    horaLlegada,
    observaciones,
    clientId: mainClientId,
  });
}

// ── Guardado parcial ─────────────────────────────────────────────────────────
export async function savePartialCheckin(
  bookingId: number,
  clientId: number | null,
  mainGuest: PartialGuestData,
): Promise<number> {
  if (clientId) {
    await updateClient(clientId, mainGuest);
    return clientId;
  }
  const newId = await createClient(mainGuest);
  // También vinculamos el ID parcial a la reserva
  await updateBookingCheckin(bookingId, { clientId: newId });
  return newId;
}
