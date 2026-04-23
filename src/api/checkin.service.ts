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

export async function submitCheckin(
  payload: CheckinSubmitPayload,
): Promise<void> {
  const { bookingId, clientId, guests, horaLlegada, observaciones } = payload;
  const catalogo = await getRelationships();

  type GuestForAPI = PartialGuestData & { parentescoParaAPI?: string };
  const finalGuests: GuestForAPI[] = [...guests];

  // 1. Parentescos
  finalGuests.forEach((guest, index) => {
    if (guest.esMenor && guest.relacionesConAdultos?.length) {
      const rel = guest.relacionesConAdultos[0];
      const adultoIndex = rel.adultoIndex;
      const codigoSeleccionado = rel.parentesco;

      if (finalGuests[adultoIndex]) {
        finalGuests[adultoIndex].parentescoParaAPI = codigoSeleccionado;
      }

      const relacionInfo = catalogo.find(
        (r) => r.codrelation === codigoSeleccionado,
      );
      if (relacionInfo?.linked_relation) {
        finalGuests[index].parentescoParaAPI = relacionInfo.linked_relation;
      }
    }
  });

  // 2. Herencia de dirección
  const CODIGOS_PROGENITOR = new Set(["PM", "TU"]);
  finalGuests.forEach((guest, index) => {
    if (!guest.esMenor || guest.direccion?.trim()) return;
    const rel = guest.relacionesConAdultos?.[0];
    if (!rel) return;
    const adulto = finalGuests[rel.adultoIndex];
    if (!adulto || adulto.esMenor) return;
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

  // 3. Titular
  let mainClientId = clientId;
  if (mainGuest) {
    if (mainClientId) {
      await updateClient(mainClientId, mainGuest);
    } else {
      mainClientId = await createClient(mainGuest);
    }
  }

  // 4. Acompañantes
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

  // 5. Limpieza
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch (e) {
    console.warn("Error limpiando antiguos:", e);
  }

  // 6. Vinculación acompañantes
  await Promise.all(
    newClientIds.map((id) =>
      createCompanion({ booking_id: bookingId, client_id: id }),
    ),
  );

  // 7. Finalizar reserva (VINCULACIÓN EXPLÍCITA DEL TITULAR)
  // 👇 Se añade mainClientId para asegurar que el booking quede vinculado al cliente
  await updateBookingCheckin(bookingId, {
    horaLlegada,
    observaciones,
    clientId: mainClientId,
  });
}

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
  // Al crear el titular parcial, también lo vinculamos a la reserva
  await updateBookingCheckin(bookingId, { clientId: newId });
  return newId;
}
