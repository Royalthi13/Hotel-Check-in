import { apiAuth } from "./axiosInstance";
import dayjs from "dayjs";
import type { GuestData, PartialGuestData } from "@/types";

// ── DICCIONARIOS DE MAPEO (Configuración del Backend) ─────────────────────────

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

const CODPAIS_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(ISO2_TO_CODPAIS).map(([k, v]) => [v, k])
);

const NAC_TO_CODPAIS: Record<string, string> = {
  "Española": "ESP",
  "Inglesa": "GBR",
  "Francesa": "FRA",
  "Alemana": "DEU",
  "Italiana": "ITA",
  "Portuguesa": "PRT",
  "Estadounidense": "USA",
  "Argentina": "ARG",
  "Mexicana": "MEX",
};

const CODPAIS_TO_NAC: Record<string, string> = Object.fromEntries(
  Object.entries(NAC_TO_CODPAIS).map(([k, v]) => [v, k])
);

const DOC_TO_COD: Record<string, string> = {
  "DNI": "NIF",
  "NIF": "NIF",
  "NIE": "NIE",
  "CIF": "CIF",
  "Pasaporte": "PAS",
  "Otro": "OTRO",
};

const COD_TO_DOC: Record<string, string> = {
  "NIF": "DNI",
  "NIE": "NIE",
  "CIF": "CIF",
  "PAS": "Pasaporte",
  "OTRO": "Otro",
};

const PARENTESCO_TO_CODRELATION: Record<string, string> = {
  "Hijo/a": "hijo",
  "Sobrino/a": "sobrino",
  "Tutor legal": "tutor",
  "Tutor/a": "tutor",
  "Otro": "otro",
};

const CODRELATION_TO_PARENTESCO: Record<string, string> = {
  "hijo": "Hijo/a",
  "sobrino": "Sobrino/a",
  "tutor": "Tutor/a",
  "otro": "Otro",
};

// ── INTERFACES ───────────────────────────────────────────────────────────────

export interface ClientResponse {
  id: number;
  name: string;
  surname: string;
  address: string | null;
  city: string | null;
  cod_city: string | null;
  province: string | null;
  cp: string | null;
  country: string;
  nationality: string | null;
  vat: string | null;             // DNI / NIF real
  phone: string | null;
  email: string | null;
  observations: string | null;
  doc_type: string | null;
  doc_support: string | null;      // Número de Soporte (ES CORREGIDO)
  birth: string | null;
  relationship: string | null;
  sex: string | null;
  validated_at: string | null;
  pre_checkin_send: string | null;
}

// ── FUNCIONES DE CONVERSIÓN ──────────────────────────────────────────────────

/**
 * Convierte un cliente de la Base de Datos al formato GuestData del Frontend
 */
export function toGuestData(c: ClientResponse): GuestData {
  const esMenor = c.birth
    ? dayjs().diff(dayjs(c.birth), "years") < 18
    : false;

  const relacionesConAdultos =
    c.relationship && CODRELATION_TO_PARENTESCO[c.relationship]
      ? [{ adultoIndex: 0, parentesco: CODRELATION_TO_PARENTESCO[c.relationship] }]
      : [];

  return {
    nombre: c.name ?? "",
    apellido: c.surname ?? "",
    apellido2: "", // La DB guarda surname concatenado
    sexo: c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac: c.birth ?? "",
    nacionalidad: CODPAIS_TO_NAC[c.nationality ?? ""] ?? "Otra",
    email: c.email ?? "",
    telefono: c.phone ?? "",
    direccion: c.address ?? "",
    ciudad: c.city ?? "",
    provincia: c.province ?? "",
    cp: c.cp ?? "",
    pais: CODPAIS_TO_ISO2[c.country] ?? "ES",
    tipoDoc: COD_TO_DOC[c.doc_type ?? ""] ?? "DNI",
    
    // FIX: Mapeo correcto para que el formulario recupere el soporte
    numDoc: c.vat ?? "",              // El DNI real viene de vat
    soporteDoc: c.doc_support ?? "",  // El Soporte real viene de doc_support
    
    vat: c.vat ?? "",
    esMenor,
    relacionesConAdultos,
  };
}

/**
 * Convierte los datos del Frontend al formato de envío (Payload) para el Backend
 */
export function toClientPayload(g: PartialGuestData): any {
  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";
  const nacCod = g.nacionalidad && g.nacionalidad !== "Otra"
    ? (NAC_TO_CODPAIS[g.nacionalidad] ?? codpais)
    : codpais;

  const docCod = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;
  const surnameCompleto = [g.apellido, g.apellido2].filter(Boolean).join(" ");

  const parentescoRaw = g.relacionesConAdultos?.[0]?.parentesco ?? "";
  const codrelation = parentescoRaw
    ? (PARENTESCO_TO_CODRELATION[parentescoRaw] ?? "otro")
    : undefined;

  return {
    name: (g.nombre ?? "").trim(),
    surname: surnameCompleto.trim(),
    sex: g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : null,
    birth: g.fechaNac || null,
    nationality: nacCod,
    email: (g.email ?? "").trim() || null,
    phone: (g.telefono ?? "").trim() || null,
    address: (g.direccion ?? "").trim() || null,
    city: (g.ciudad ?? "").trim() || null,
    province: (g.provincia ?? "").trim() || null,
    cp: (g.cp ?? "").trim() || null,
    country: codpais,
    doc_type: docCod,
    
    // FIX: Guardamos cada dato en su columna correspondiente de la DB
    vat: (g.numDoc ?? "").trim(),           // El DNI va a la columna vat
    doc_support: (g.soporteDoc ?? "").trim(), // El Soporte va a la columna doc_support
    
    relationship: codrelation,
  };
}

// ── SERVICIOS API ────────────────────────────────────────────────────────────

export async function getClientById(clientId: number): Promise<GuestData> {
  const { data } = await apiAuth.get<ClientResponse>(`/clients/${clientId}`);
  return toGuestData(data);
}

export async function createClient(guest: PartialGuestData): Promise<number> {
  const { data } = await apiAuth.post<ClientResponse>("/clients", toClientPayload(guest));
  return data.id;
}

export async function updateClient(clientId: number, guest: PartialGuestData): Promise<void> {
  await apiAuth.put(`/clients/${clientId}`, toClientPayload(guest));
}

export async function validateClient(clientId: number): Promise<void> {
  await apiAuth.patch(`/clients/${clientId}/validate`);
}