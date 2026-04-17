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
// ── ISO2 ↔ codpais ────────────────────────────────────────────────────────────
const ISO2_TO_CODPAIS: Record<string, string> = {
  ES: "ESP", GB: "GBR", FR: "FRA", DE: "DEU", IT: "ITA",
  PT: "PRT", US: "USA", CA: "CAN", MX: "MEX", AR: "ARG",
  CO: "COL", BR: "BRA", CL: "CHL", PE: "PER", VE: "VEN",
  UY: "URY", EC: "ECU", BO: "BOL", PY: "PRY", CR: "CRI",
  PA: "PAN", DO: "DOM", CU: "CUB", NL: "NLD", BE: "BEL",
  CH: "CHE", AT: "AUT", SE: "SWE", NO: "NOR", DK: "DNK",
  FI: "FIN", IE: "IRL", GR: "GRC", PL: "POL", CZ: "CZE",
  HU: "HUN", RO: "ROU", TR: "TUR", RU: "RUS", CN: "CHN",
  JP: "JPN", KR: "KOR", IN: "IND", AU: "AUS", NZ: "NZL",
  ZA: "ZAF", EG: "EGY", MA: "MAR", SA: "SAU", AE: "ARE",
  IL: "ISR", SG: "SGP", TH: "THA", PH: "PHL", VN: "VNM",
  ID: "IDN", MY: "MYS", PK: "PAK", BD: "BGD", IR: "IRN",
  IQ: "IRQ", NG: "NGA", KE: "KEN",
};

const NAC_TO_CODPAIS: Record<string, string> = {
  "Española": "ESP", "Inglesa": "GBR", "Francesa": "FRA",
  "Alemana": "DEU", "Italiana": "ITA", "Portuguesa": "PRT",
  "Estadounidense": "USA", "Argentina": "ARG", "Mexicana": "MEX",
};

// Tipo documento — BD acepta: CIF, NIE, NIF, OTRO, PAS
const DOC_TO_COD: Record<string, string> = {
  "DNI": "NIF", "NIF": "NIF", "NIE": "NIE",
  "CIF": "CIF", "Pasaporte": "PAS", "Otro": "OTRO",
};

// Parentesco → relationship
const PARENTESCO_TO_CODRELATION: Record<string, string> = {
  "Hijo/a": "hijo", "Sobrino/a": "sobrino", "Tutor legal": "tutor",
  "Tutor/a": "tutor", "Abuelo/a": "otro", "Bisabuelo/a": "otro",
  "Bisnieto/a": "otro", "Cuñado/a": "otro", "Cónyuge/a": "otro",
  "Hermano/a": "otro", "Nieto/a": "otro", "Padre o Madre": "otro",
  "Suegro/a": "otro", "Tío/a": "otro", "Yerno o nuera": "otro",
  "Otro": "otro",
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
}// ── GuestData → payload API ────────────────────────────────────────────────────
export function toClientPayload(g: PartialGuestData): Record<string, unknown> {
  const str = (v: string | undefined | null) => v?.trim() || null;
  const esMenor = !!g.esMenor;

  // Los menores NO tienen dirección ni contacto propios — se envían como null.
  // La dirección real la comparte el adulto responsable vía relationship.

  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";
  const nacCod =
    g.nacionalidad && g.nacionalidad !== "Otra"
      ? (NAC_TO_CODPAIS[g.nacionalidad] ?? codpais)
      : codpais;
  const docCod = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;

  const apellido1 = (g.apellido  ?? "").trim();
  const apellido2 = (g.apellido2 ?? "").trim();
  const surname   = [apellido1, apellido2].filter(Boolean).join(" ");

  const parentescoRaw = g.relacionesConAdultos?.[0]?.parentesco ?? "";
  const codrelation   = parentescoRaw
    ? (PARENTESCO_TO_CODRELATION[parentescoRaw] ?? "otro")
    : undefined;

  return {
    name:        str(g.nombre) ?? "",
    surname:     surname       || "",
    sex:         g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : null,
    birth:       g.fechaNac    || null,
    nationality: nacCod,
    country:     codpais,

    email:       esMenor ? null : str(g.email),
    phone:       esMenor
      ? null
      : (g.telefono?.trim()
          ? `${g.prefijo ?? '+34'} ${g.telefono.trim()}`.trim()
          : null),

    address:     esMenor ? null : str(g.direccion),
    city:        esMenor ? null : str(g.ciudad),
    province:    esMenor ? null : str(g.provincia),
    cp:          esMenor ? null : str(g.cp),

    doc_type:    docCod ?? null,
    vat:         str(g.numDoc),
    doc_support: str(g.soporteDoc),
    relationship: codrelation ?? null,
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
