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
// Solo para los idiomas soportados en el selector del frontend.
// Para cualquier otro país se usa "Otra" al cargar (no "Española").
const NAC_TO_CODPAIS: Record<string, string> = {
  "Española":        "ESP",
  "Inglesa":         "GBR",
  "Francesa":        "FRA",
  "Alemana":         "DEU",
  "Italiana":        "ITA",
  "Portuguesa":      "PRT",
  "Estadounidense":  "USA",
  "Argentina":       "ARG",
  "Mexicana":        "MEX",
  // "Otra" intencionadamente sin mapeo fijo — ver toClientPayload
};
const CODPAIS_TO_NAC: Record<string, string> = {
  "ESP": "Española", "GBR": "Inglesa", "FRA": "Francesa",
  "DEU": "Alemana",  "ITA": "Italiana","PRT": "Portuguesa",
  "USA": "Estadounidense", "ARG": "Argentina", "MEX": "Mexicana",
};

// ── Tipo documento ────────────────────────────────────────────────────────────
// BD: CIF, NIE, NIF, OTRO, PAS
const DOC_TO_COD: Record<string, string> = {
  "DNI":       "NIF",
  "NIF":       "NIF",
  "NIE":       "NIE",
  "CIF":       "CIF",
  "Pasaporte": "PAS",
  "Otro":      "OTRO",
};
const COD_TO_DOC: Record<string, string> = {
  "NIF": "DNI", "NIE": "NIE", "CIF": "CIF",
  "PAS": "Pasaporte", "OTRO": "Otro",
};

// ── Parentesco ────────────────────────────────────────────────────────────────
// CompanionBase no tiene relationship — se guarda en clients.relationship.
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
// Inverso: codrelation → label frontend
const CODRELATION_TO_PARENTESCO: Record<string, string> = {
  "hijo":    "Hijo/a",
  "sobrino": "Sobrino/a",
  "tutor":   "Tutor/a",
  "otro":    "Otro",
};

// ── Schema real ClientInDB ────────────────────────────────────────────────────
interface ClientResponse {
  id:               number;
  name:             string;
  surname:          string;
  address:          string | null;
  city:             string | null;
  cod_city:         string | null;
  province:         string | null;
  cp:               string | null;
  country:          string;
  nationality:      string | null;
  vat:              string | null;
  phone:            string | null;
  email:            string | null;
  observations:     string | null;
  doc_type:         string | null;
  doc_support:      string | null;  // almacena el numDoc del frontend
  birth:            string | null;
  relationship:     string | null;  // codrelation (FK)
  sex:              string | null;
  validated_at:     string | null;
  pre_checkin_send: string | null;
}

interface ClientPayload {
  name:    string;
  surname: string;
  country: string;
  [key: string]: string | boolean | undefined;
}

// ── DB → GuestData ─────────────────────────────────────────────────────────────
export function toGuestData(c: ClientResponse): GuestData {
  // esMenor calculado desde la fecha real, no hardcoded a false
  const esMenor = c.birth
    ? dayjs().diff(dayjs(c.birth), "years") < 18
    : false;

  // Recuperar parentesco si existe (para menores cargados como acompañantes)
  // adultoIndex 0 = se asume relación con el titular
  const relacionesConAdultos =
    c.relationship && CODRELATION_TO_PARENTESCO[c.relationship]
      ? [{ adultoIndex: 0, parentesco: CODRELATION_TO_PARENTESCO[c.relationship] }]
      : [];

  return {
    nombre:       c.name    ?? "",
    apellido:     c.surname ?? "",
    apellido2:    "",          // se guardó concatenado en surname, no se puede separar
    sexo:         c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac:     c.birth   ?? "",
    // FIX: si el codpais no está en el mapa de 9 opciones → "Otra", no "Española"
    nacionalidad: CODPAIS_TO_NAC[c.nationality ?? ""] ?? "Otra",
    email:        c.email    ?? "",
    telefono:     c.phone    ?? "",
    direccion:    c.address  ?? "",
    ciudad:       c.city     ?? "",
    provincia:    c.province ?? "",
    cp:           c.cp       ?? "",
    pais:         CODPAIS_TO_ISO2[c.country] ?? "ES",
    tipoDoc:      COD_TO_DOC[c.doc_type ?? ""] ?? "DNI",
    numDoc:       c.doc_support ?? "",  // doc_support almacena el número de documento
    soporteDoc:   "",                   // no se guarda en BD (campo único doc_support)
    vat:          c.vat ?? "",
    esMenor,
    relacionesConAdultos,
  };
}

// ── GuestData → payload API ────────────────────────────────────────────────────
export function toClientPayload(g: PartialGuestData): ClientPayload {
  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";

  // Nacionalidad: si es "Otra" usamos el mismo país de residencia como fallback
  const nacCod = g.nacionalidad && g.nacionalidad !== "Otra"
    ? (NAC_TO_CODPAIS[g.nacionalidad] ?? codpais)
    : codpais;

  const docCod = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;

  // apellido + apellido2 concatenados en el campo surname (único campo en BD)
  const apellido1 = (g.apellido  ?? "").trim();
  const apellido2 = (g.apellido2 ?? "").trim();
  const surnameCompleto = [apellido1, apellido2].filter(Boolean).join(" ");

  // Parentesco del menor → clients.relationship (CompanionBase no tiene este campo)
  const parentescoRaw = g.relacionesConAdultos?.[0]?.parentesco ?? "";
  const codrelation   = parentescoRaw
    ? (PARENTESCO_TO_CODRELATION[parentescoRaw] ?? "otro")
    : undefined;

  const raw: Record<string, string | boolean | undefined> = {
    name:         (g.nombre ?? "").trim()    || undefined,
    surname:      surnameCompleto            || undefined,
    sex:          g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : undefined,
    birth:        g.fechaNac || undefined,
    nationality:  nacCod    || undefined,
    email:        (g.email     ?? "").trim() || undefined,
    phone:        (g.telefono  ?? "").trim() || undefined,
    address:      (g.direccion ?? "").trim() || undefined,
    city:         (g.ciudad    ?? "").trim() || undefined,
    province:     (g.provincia ?? "").trim() || undefined,
    cp:           (g.cp        ?? "").trim() || undefined,
    country:      codpais,
    doc_type:     docCod,
    doc_support:  (g.numDoc    ?? "").trim() || undefined,
    vat:          (g.vat       ?? "").trim() || undefined,
    relationship: codrelation,
  };

  const payload: ClientPayload = {
    name:    raw.name    as string,
    surname: raw.surname as string,
    country: codpais,
  };
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

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