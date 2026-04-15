import { apiAuth } from "./axiosInstance";
import dayjs from "dayjs";
import type { GuestData, PartialGuestData } from "@/types";

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

const CODPAIS_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(ISO2_TO_CODPAIS).map(([k, v]) => [v, k]),
);

// ── Nacionalidad ↔ codpais ────────────────────────────────────────────────────
const NAC_TO_CODPAIS: Record<string, string> = {
  "Española":       "ESP",
  "Inglesa":        "GBR",
  "Francesa":       "FRA",
  "Alemana":        "DEU",
  "Italiana":       "ITA",
  "Portuguesa":     "PRT",
  "Estadounidense": "USA",
  "Argentina":      "ARG",
  "Mexicana":       "MEX",
};
// "Otra" sin mapeo fijo — al cargar se usa fallback "Otra"
const CODPAIS_TO_NAC: Record<string, string> = Object.fromEntries(
  Object.entries(NAC_TO_CODPAIS).map(([k, v]) => [v, k]),
);

// ── Tipo documento ────────────────────────────────────────────────────────────
// BD acepta: CIF, NIE, NIF, OTRO, PAS
const DOC_TO_COD: Record<string, string> = {
  "DNI":       "NIF",
  "NIF":       "NIF",
  "NIE":       "NIE",
  "CIF":       "CIF",
  "Pasaporte": "PAS",
  "Otro":      "OTRO",
};
const COD_TO_DOC: Record<string, string> = {
  "NIF": "DNI",
  "NIE": "NIE",
  "CIF": "CIF",
  "PAS": "Pasaporte",
  "OTRO": "Otro",
};

// ── Parentesco ────────────────────────────────────────────────────────────────
// CompanionBase NO tiene relationship → se guarda en clients.relationship
const PARENTESCO_TO_CODRELATION: Record<string, string> = {
  "Hijo/a":        "hijo",
  "Sobrino/a":     "sobrino",
  "Tutor legal":   "tutor",
  "Tutor/a":       "tutor",
  "Abuelo/a":      "otro",
  "Bisabuelo/a":   "otro",
  "Bisnieto/a":    "otro",
  "Cuñado/a":      "otro",
  "Cónyuge/a":     "otro",
  "Hermano/a":     "otro",
  "Nieto/a":       "otro",
  "Padre o Madre": "otro",
  "Suegro/a":      "otro",
  "Tío/a":         "otro",
  "Yerno o nuera": "otro",
  "Otro":          "otro",
};
const CODRELATION_TO_PARENTESCO: Record<string, string> = {
  "hijo":    "Hijo/a",
  "sobrino": "Sobrino/a",
  "tutor":   "Tutor/a",
  "otro":    "Otro",
};

// ── Schema real ClientInDB (backend FastAPI) ──────────────────────────────────
interface ClientResponse {
  id:               number;
  name:             string;
  surname:          string;
  address:          string | null;
  city:             string | null;
  cod_city:         string | null;
  province:         string | null;
  cp:               string | null;
  country:          string;           // FK → countries.codpais (ej: "ESP")
  nationality:      string | null;    // FK → countries.codpais
  vat:              string | null;    // ← AQUÍ SE GUARDA EL NÚMERO DE DNI/NIE/PAS
  phone:            string | null;
  email:            string | null;
  observations:     string | null;
  doc_type:         string | null;    // FK → document_type.coddoc (NIF|NIE|CIF|OTRO|PAS)
  doc_support:      string | null;    // ← AQUÍ SE GUARDA EL NÚMERO DE SOPORTE (campo físico del DNI)
  birth:            string | null;    // "YYYY-MM-DD"
  relationship:     string | null;    // FK → relationship.codrelation
  sex:              string | null;    // "M" | "F"
  validated_at:     string | null;
  pre_checkin_send: string | null;
}

// ── DB → GuestData ─────────────────────────────────────────────────────────────
export function toGuestData(c: ClientResponse): GuestData {
  // esMenor calculado desde fechaNac real
  const esMenor = c.birth
    ? dayjs().diff(dayjs(c.birth), "years") < 18
    : false;

  // Recuperar parentesco del menor si existe
  const relacionesConAdultos =
    c.relationship && CODRELATION_TO_PARENTESCO[c.relationship]
      ? [{ adultoIndex: 0, parentesco: CODRELATION_TO_PARENTESCO[c.relationship] }]
      : [];

  return {
    nombre:    c.name    ?? "",
    apellido:  c.surname ?? "",
    apellido2: "",  // BD guarda surname concatenado — no se puede separar
    sexo:      c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac:  c.birth   ?? "",
    // Si el codpais no está en el mapa de 9 opciones → "Otra"
    nacionalidad: CODPAIS_TO_NAC[c.nationality ?? ""] ?? "Otra",
    email:     c.email    ?? "",
    telefono:  c.phone    ?? "",
    direccion: c.address  ?? "",
    ciudad:    c.city     ?? "",
    provincia: c.province ?? "",
    cp:        c.cp       ?? "",
    pais:      CODPAIS_TO_ISO2[c.country] ?? "ES",
    tipoDoc:   COD_TO_DOC[c.doc_type ?? ""] ?? "DNI",

    // MAPEO CORRECTO:
    // vat (columna BD)         → numDoc (número del documento: DNI, NIE, pasaporte…)
    // doc_support (columna BD) → soporteDoc (código alfanumérico físico del carné)
    numDoc:    c.vat         ?? "",
    soporteDoc: c.doc_support ?? "",

    esMenor,
    relacionesConAdultos,
  };
}

// ── GuestData → payload API ────────────────────────────────────────────────────
export function toClientPayload(g: PartialGuestData): Record<string, unknown> {
  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";

  // Nacionalidad: si es "Otra" usamos el mismo país de residencia como fallback
  const nacCod =
    g.nacionalidad && g.nacionalidad !== "Otra"
      ? (NAC_TO_CODPAIS[g.nacionalidad] ?? codpais)
      : codpais;

  const docCod = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;

  // apellido + apellido2 concatenados (BD solo tiene un campo surname)
  const apellido1 = (g.apellido  ?? "").trim();
  const apellido2 = (g.apellido2 ?? "").trim();
  const surname   = [apellido1, apellido2].filter(Boolean).join(" ");

  // Parentesco del menor → clients.relationship (CompanionBase no lo tiene)
  const parentescoRaw = g.relacionesConAdultos?.[0]?.parentesco ?? "";
  const codrelation   = parentescoRaw
    ? (PARENTESCO_TO_CODRELATION[parentescoRaw] ?? "otro")
    : undefined;

  const str = (v: string | undefined | null) => v?.trim() || null;

  return {
    name:        str(g.nombre)    ?? "",   // required
    surname:     surname          || "",   // required
    sex:         g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : null,
    birth:       g.fechaNac       || null,
    nationality: nacCod,
    country:     codpais,
    email:       str(g.email),phone:       g.telefono?.trim()
                   ? `${g.prefijo ?? '+34'} ${g.telefono.trim()}`.trim()
                   : null,
    address:     str(g.direccion),
    city:        str(g.ciudad),
    province:    str(g.provincia),
    cp:          str(g.cp),
    doc_type:    docCod           ?? null,

    // MAPEO CORRECTO (inverso de toGuestData):
    // numDoc (DNI/NIE/PAS) → columna vat
    // soporteDoc            → columna doc_support
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
  const { data } = await apiAuth.post<ClientResponse>("/clients", toClientPayload(guest));
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