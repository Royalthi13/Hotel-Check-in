import { getBookingById, updateBookingCheckin } from "./bookings.service";
import { getClientById, createClient, updateClient } from "./clients.service";
import { getCompanionsByBooking, createCompanion } from "./companions.service";
import type { GuestData, PartialGuestData, Reserva } from "@/types";
import { getRelationships } from "./catalogs.service";
import { api } from "./axiosInstance";
import type { PreCheckinStatus } from "@/types";

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

// ── Consulta el estado real del pre-checkin en el backend ─────────────────────
async function getCheckinStatus(
  bookingId: number,
): Promise<PreCheckinStatus | null> {
  try {
    const { data, status } = await api.get<PreCheckinStatus>(
      `/pre-checkin/booking/${bookingId}/status`,
      { validateStatus: (s) => s === 200 || s === 403 || s === 404 },
    );
    if (status !== 200) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadCheckinData(
  bookingId: string | number,
): Promise<CheckinLoadResult> {
  const {
    reserva,
    clientId,
    bookingId: id,
    raw,
  } = await getBookingById(bookingId);

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

      companions = detailsResults
        .filter(
          (r): r is PromiseFulfilledResult<GuestData> =>
            r.status === "fulfilled",
        )
        .map((r) => ({
          ...r.value,
          esMenor: r.value.fechaNac
            ? new Date().getFullYear() -
                new Date(r.value.fechaNac).getFullYear() <
              18
            : (r.value.esMenor ?? false),
          relacionesConAdultos: r.value.relacionesConAdultos ?? [],
        }));
    }
  } catch (e) {
    console.warn("Error cargando acompañantes:", e);
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
): Promise<{ isComplete: boolean }> {
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
      const adulto = finalGuests[adultoIndex];

      if (adulto) {
        // 1.1 Asignamos al adulto el código original (Ej: "PM")
        if (!adulto.parentescoParaAPI) {
          adulto.parentescoParaAPI = codigoSeleccionado;
        }

        // 1.2 Buscamos en el catálogo de tu BD (limpiando espacios y asegurando mayúsculas)
        const relacionInfo = catalogo.find(
          (r) =>
            r.codrelation?.trim().toUpperCase() ===
            codigoSeleccionado?.trim().toUpperCase(),
        );

        // 1.3 Asignamos al menor su inversa (Ej: "HJ") o un fallback si es null (Ej: "OT")
        if (relacionInfo?.linked_relation) {
          finalGuests[index].parentescoParaAPI = relacionInfo.linked_relation;
        } else {
          // Si la BD dice <null> o falla, le ponemos "OT" (Otro).
          // ESTO ES CLAVE: Al ponerle un valor, evitamos que en clients.service
          // haga el fallback y se copie el "PM" del adulto por error.
          finalGuests[index].parentescoParaAPI = "OT";
        }
      }
    }
  });

  // 2. Herencia de dirección para menores
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

  // 3. Observaciones del titular
  let obsFinales = observaciones?.trim() || null;
  if (
    horaLlegada &&
    horaLlegada !== "No especificada" &&
    !horaLlegada.startsWith("No ")
  ) {
    const sufijo = `Hora llegada: ${horaLlegada}`;
    obsFinales = obsFinales ? `${obsFinales}\n${sufijo}` : sufijo;
  }

  // 4. Guardar titular
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

  // 5. Guardar acompañantes — recoger todos los IDs registrados en este submit
  const registeredInThisSubmit: number[] = mainClientId ? [mainClientId] : [];

  for (const guest of companionGuests) {
    if (!guest.nombre?.trim() && !guest.numDoc?.trim()) continue;

    if (guest.id) {
      await updateClient(guest.id, guest);
      registeredInThisSubmit.push(guest.id);
    } else {
      const newId = await createClient(guest);
      registeredInThisSubmit.push(newId);
      await createCompanion({
        booking_id: bookingId,
        client_id: newId,
      });
    }
  } // 6. Marcar la reserva como pre-checkeada y guardar hora/notas en booking
  await updateBookingCheckin(bookingId, {
    horaLlegada,
    observaciones,
    clientId: mainClientId,
    markCompleted: true,
  });
  // 7. ¿Está el pre-checkin completamente terminado?
  const status = await getCheckinStatus(bookingId);
  if (import.meta.env.DEV) {
    console.log("[checkin] STATUS RESPONSE:", JSON.stringify(status));
  }

  const checkinCompleto = status !== null && status.persons_to_create === 0;

  return { isComplete: checkinCompleto };
}

// Guardado parcial del titular — usado por handlePartialSubmit (botón explícito)
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
// Autoguardado por huésped al pasar al siguiente.
// - Si guest.id existe → updateClient (idempotente)
// - Si no, titular → createClient + linkar a la reserva (booking.client_id)
// - Si no, acompañante → createClient + createCompanion link
// Devuelve el id para que el caller lo sincronice al state.
export async function savePartialGuest(
  bookingId: number,
  guest: PartialGuestData,
  isMain: boolean,
): Promise<number> {
  if (guest.id) {
    await updateClient(guest.id, guest);
    return guest.id;
  }
  const newId = await createClient(guest);
  if (isMain) {
    // Vincular el titular nuevo a la reserva sin marcar pre_checking todavía.
    // Eso lo hace updateBookingCheckin en el submit final.
    await updateBookingCheckin(bookingId, { clientId: newId }, undefined);
  } else {
    await createCompanion({ booking_id: bookingId, client_id: newId });
  }
  return newId;
}
