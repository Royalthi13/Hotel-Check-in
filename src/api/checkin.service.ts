  import { getBookingById } from "./bookings.service";
  import { getClientById, createClient, updateClient } from "./clients.service";
  import { getCompanionsByBooking, createCompanion } from "./companions.service";
  import type { GuestData, PartialGuestData, Reserva } from "@/types";
  import { getRelationships } from "./catalogs.service";
  import { apiAuth } from "./axiosInstance";
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
  async function getCheckinStatus(bookingId: number): Promise<PreCheckinStatus | null> {
    try {
      const { data, status } = await apiAuth.get<PreCheckinStatus>(
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

        companions = detailsResults
          .filter(
            (r): r is PromiseFulfilledResult<GuestData> => r.status === "fulfilled",
          )
          .map((r) => ({
            ...r.value,
            esMenor: r.value.fechaNac
              ? new Date().getFullYear() - new Date(r.value.fechaNac).getFullYear() < 18
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
    }

    // 6. ¿Está el pre-checkin completamente terminado?
    //    Consultamos el status real al backend — es el único que sabe
    //    cuántas personas quedan por completar (data_full=false) o por crear.
    const status = await getCheckinStatus(bookingId);
    console.log("[checkin] STATUS RESPONSE:", JSON.stringify(status));

// Solo comprobamos persons_to_create (personas que aún no existen en BD).
// persons_to_complete NO se puede usar aquí porque data_full=false hasta que
// llamemos a validateClient — sería una dependencia circular.
const checkinCompleto =
  status !== null &&
  status.persons_to_create === 0;
  
  return { isComplete: checkinCompleto };
}

  // Guardado parcial — NO llama validateClient nunca
  // Guardado parcial — NO llama validateClient nunca
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