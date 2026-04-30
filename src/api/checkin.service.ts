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
      console.warn("No se pudo cargar el titular:", e);
      knownGuest = null;
    }
  }

  let companions: GuestData[] = [];
  try {
    const companionLinks = await getCompanionsByBooking(bookingId);

    if (companionLinks.length > 0) {
      const detailsResults = await Promise.allSettled(
        companionLinks.map((link) => getClientById(link.client_id)),
      );

      const guestsFound = detailsResults
        .filter(
          (r): r is PromiseFulfilledResult<GuestData> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);

      // Rehidratación por ID real
      const idToIndex = new Map<number, number>();
      if (clientId) idToIndex.set(clientId, 0);

      guestsFound.forEach((g, i) => {
        if (g.id) idToIndex.set(g.id, i + 1);
      });

      companions = guestsFound.map((guest) => {
        const linkData = companionLinks.find((l) => l.client_id === guest.id);

        if (guest.esMenor && linkData?.parentesco && clientId) {
          const adultoIdx = idToIndex.get(clientId);

          return {
            ...guest,
            relacionesConAdultos:
              adultoIdx !== undefined
                ? [
                    {
                      adultoIndex: adultoIdx,
                      parentesco: linkData.parentesco,
                    },
                  ]
                : [],
          };
        }
        return guest;
      });
    }
  } catch (e) {
    console.warn("Error rehidratando acompañantes:", e);
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

// ── Envío final del Check-in ─────────────────────────────────────────────────
export async function submitCheckin(
  payload: CheckinSubmitPayload,
): Promise<void> {
  const { bookingId, clientId, guests, horaLlegada, observaciones } = payload;
  const catalogo = await getRelationships();

  type GuestForAPI = PartialGuestData & { parentescoParaAPI?: string };
  const finalGuests: GuestForAPI[] = [...guests];

  // 1. Parentescos (con protección de sobrescritura)
  finalGuests.forEach((guest, index) => {
    if (guest.esMenor && guest.relacionesConAdultos?.length) {
      const rel = guest.relacionesConAdultos[0];
      const adultoIndex = rel.adultoIndex;
      const codigoSeleccionado = rel.parentesco;

      const adulto = finalGuests[adultoIndex];
      if (adulto) {
        if (!adulto.parentescoParaAPI) {
          adulto.parentescoParaAPI = codigoSeleccionado;
        }

        const relacionInfo = catalogo.find(
          (r) => r.codrelation === codigoSeleccionado,
        );
        if (relacionInfo?.linked_relation) {
          finalGuests[index].parentescoParaAPI = relacionInfo.linked_relation;
        }
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
  const parentescosMap = new Map<number, string>();

  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;

    let id = guest.id;
    if (id) {
      await updateClient(id, guest);
    } else {
      id = await createClient(guest);
    }

    newClientIds.push(id);
    if (guest.parentescoParaAPI) {
      parentescosMap.set(id, guest.parentescoParaAPI);
    }
  }

  // 5. Limpieza antiguos
  try {
    const existing = await getCompanionsByBooking(bookingId);
    const toDelete = existing.filter((c) => c.client_id !== mainClientId);
    await Promise.all(toDelete.map((c) => deleteCompanion(c.id)));
  } catch (e) {
    console.warn("Error limpiando antiguos:", e);
  }

  // 6. Vincular nuevos
  await Promise.all(
    newClientIds.map((id) =>
      createCompanion({
        booking_id: bookingId,
        client_id: id,
        parentesco: parentescosMap.get(id) || null,
      }),
    ),
  );

  // 7. Finalizar
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
  await updateBookingCheckin(bookingId, { clientId: newId });
  return newId;
}
