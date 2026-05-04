import { getBookingById } from "./bookings.service";
import { getClientById, createClient, updateClient } from "./clients.service";
import {
  getCompanionsByBooking,
  createCompanion,
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
  bookingId: string | number,
): Promise<CheckinLoadResult> {
  const { reserva, clientId, bookingId: id, raw } = await getBookingById(bookingId);

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
   const companionLinks = await getCompanionsByBooking(id);

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
    bookingId: id,
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

  // 3. Construir observaciones del titular (hora de llegada + texto libre)
  let obsFinales = observaciones?.trim() || null;
  if (
    horaLlegada &&
    horaLlegada !== "No especificada" &&
    !horaLlegada.startsWith("No ")
  ) {
    const sufijo = `Hora llegada: ${horaLlegada}`;
    obsFinales = obsFinales ? `${obsFinales}\n${sufijo}` : sufijo;
  }

  // 4. Titular
  let mainClientId = clientId;
  if (mainGuest) {
    const guestWithObs: PartialGuestData = {
      ...mainGuest,
      observations: obsFinales ?? undefined,
    };
    if (mainClientId) {
      await updateClient(mainClientId, guestWithObs);
    } else {
      mainClientId = await createClient(guestWithObs);
    }
  }

  // 5. Acompañantes: actualizar existentes o crear nuevos con vínculo
  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;

    if (guest.id) {
      // El vínculo companion ya existe — solo actualizamos los datos del cliente
      await updateClient(guest.id, guest);
    } else {
      // Acompañante nuevo: crear cliente y vincular a la reserva
      const newId = await createClient(guest);
      await createCompanion({
        booking_id: bookingId,
        client_id: newId,
        parentesco:
          (guest as GuestForAPI).parentescoParaAPI ??
          guest.relacionesConAdultos?.[0]?.parentesco ??
          null,
      });
    }
  }
}
export async function savePartialCheckin(
  clientId: number | null,
  mainGuest: PartialGuestData,
): Promise<number> {
  if (clientId) {
    await updateClient(clientId, mainGuest);
    return clientId;
  }
  return await createClient(mainGuest);
}