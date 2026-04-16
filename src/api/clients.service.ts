import { apiAuth } from "./axiosInstance";
import dayjs from "dayjs";
import type { GuestData, PartialGuestData } from "@/types";

// ── Schema real ClientInDB ──────────────────────────────────
interface ClientResponse {
  id: number;
  name: string;
  surname: string;
  address: string | null;
  city: string | null;
  cod_city: string | null; // ID de la ciudad en BBDD
  province: string | null;
  cp: string | null;
  country: string;
  nationality: string | null;
  vat: string | null;
  phone: string | null;
  email: string | null;
  observations: string | null;
  doc_type: string | null;
  doc_support: string | null;
  birth: string | null;
  relationship: string | null;
  sex: string | null;
}

/**
 * Mapa inverso para Nacionalidades.
 * Si no quieres que esté aquí "hardcodeado", lo ideal es que lo importes
 * de tu archivo de constantes o que el selector de la UI ya guarde el código (ESP)
 * en lugar del texto (Española).
 */
const MAPA_NACIONALIDAD: Record<string, string> = {
  Española: "ESP",
  Alemana: "DEU",
  Francesa: "FRA",
  Italiana: "ITA",
  Portuguesa: "PRT",
  Inglesa: "GBR",
  Estadounidense: "USA",
};

// ── DB → GuestData ─────────────────────────────────────────────────────────────
export function toGuestData(c: ClientResponse): GuestData {
  const esMenor = c.birth ? dayjs().diff(dayjs(c.birth), "years") < 18 : false;

  return {
    id: c.id,
    nombre: c.name ?? "",
    apellido: c.surname ?? "",
    apellido2: "",
    sexo: c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac: c.birth ?? "",

    nacionalidad: c.nationality ?? "ESP",
    pais: c.country ?? "ESP",
    tipoDoc: c.doc_type ?? "NIF",

    email: c.email ?? "",
    telefono: c.phone ?? "",
    direccion: c.address ?? "",
    ciudad: c.city ?? "",
    codCity: c.cod_city ?? "", // Recuperamos el ID de la ciudad para el estado
    provincia: c.province ?? "",
    cp: c.cp ?? "",
    numDoc: c.vat ?? "",
    soporteDoc: c.doc_support ?? "",
    esMenor,

    relacionesConAdultos: c.relationship
      ? [{ adultoIndex: 0, parentesco: c.relationship }]
      : [],
  };
}

// ── GuestData → payload API ────────────────────────────────────────────────────
// ── GuestData → payload API ────────────────────────────────────────────────────
export function toClientPayload(g: PartialGuestData): Record<string, unknown> {
  const str = (v: string | undefined | null) => v?.trim() || null;

  // Unimos apellido y apellido2, filtrando los que estén vacíos
  const surname = [str(g.apellido), str(g.apellido2)].filter(Boolean).join(" ");

  // Convertimos el texto de nacionalidad al código ISO esperado (ESP, DEU...)
  const codNacionalidad =
    MAPA_NACIONALIDAD[g.nacionalidad || ""] || g.nacionalidad || "ESP";

  return {
    name: str(g.nombre) ?? "",
    surname: surname || "", // 🔥 AQUÍ es donde usamos la constante correctamente
    sex: g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : null,
    birth: g.fechaNac || null,

    nationality: codNacionalidad,
    country: g.pais || "ESP",
    doc_type: g.tipoDoc || null,

    email: str(g.email),
    phone: str(g.telefono),
    address: str(g.direccion),
    city: str(g.ciudad),
    cod_city: g.codCity || null,
    province: str(g.provincia),
    cp: str(g.cp),
    vat: str(g.numDoc),
    doc_support: str(g.soporteDoc),
  };
}
// ── Servicios API ─────────────────────────────────────────────────────────────

export async function getClientById(clientId: number): Promise<GuestData> {
  const { data } = await apiAuth.get<ClientResponse>(`/clients/${clientId}`);
  return toGuestData(data);
}

export async function createClient(guest: PartialGuestData): Promise<number> {
  const { data } = await apiAuth.post<ClientResponse>(
    "/clients",
    toClientPayload(guest),
  );
  return data.id;
}

export async function updateClient(
  clientId: number,
  guest: PartialGuestData,
): Promise<void> {
  await apiAuth.put(`/clients/${clientId}`, toClientPayload(guest));
}

export async function validateClient(clientId: number): Promise<void> {
  await apiAuth.patch(`/clients/${clientId}/validate`);
}
