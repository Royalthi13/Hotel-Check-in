import { apiAuth } from "./axiosInstance";
import type { GuestData, PartialGuestData } from "@/types";

// ISO2 → codpais (FK countries)
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

const NAC_TO_CODPAIS: Record<string, string> = {
  "Española": "ESP", "Inglesa": "GBR", "Francesa": "FRA",
  "Alemana": "DEU", "Italiana": "ITA", "Portuguesa": "PRT",
  "Estadounidense": "USA", "Argentina": "ARG", "Mexicana": "MEX",
  "Otra": "ESP",
};
const CODPAIS_TO_NAC: Record<string, string> = {
  "ESP": "Española", "GBR": "Inglesa", "FRA": "Francesa",
  "DEU": "Alemana",  "ITA": "Italiana","PRT": "Portuguesa",
  "USA": "Estadounidense", "ARG": "Argentina", "MEX": "Mexicana",
};

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

interface ClientResponse {
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
  vat: string | null;
  phone: string | null;
  email: string | null;
  observations: string | null;
  doc_type: string | null;
  doc_support: string | null;
  birth: string | null;
  relationship: string | null;
  sex: string | null;
  validated_at: string | null;
  pre_checkin_send: string | null;
}

// ── Payload hacia el backend ──────────────────────────────────────────────────
// CORRECCIÓN: usamos Record<string, string | boolean> en vez de campos opcionales
// para que JSON.stringify no incluya claves con valor undefined (causa 422 en
// algunos backends FastAPI/Pydantic que rechazan campos desconocidos).
interface ClientPayload {
  name: string;
  surname: string;
  country: string;
  [key: string]: string | boolean | undefined;
}

function toGuestData(c: ClientResponse): GuestData {
  return {
    nombre:       c.name     ?? "",
    apellido:     c.surname  ?? "",
    apellido2:    "",
    sexo:         c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac:     c.birth    ?? "",
    nacionalidad: CODPAIS_TO_NAC[c.nationality ?? ""] ?? "Española",
    email:        c.email    ?? "",
    telefono:     c.phone    ?? "",
    direccion:    c.address  ?? "",
    ciudad:       c.city     ?? "",
    provincia:    c.province ?? "",
    cp:           c.cp       ?? "",
    pais:         CODPAIS_TO_ISO2[c.country] ?? "ES",
    tipoDoc:      COD_TO_DOC[c.doc_type ?? ""] ?? "DNI",
    numDoc:       c.doc_support ?? "",
    soporteDoc:   "",
    vat:          c.vat      ?? "",
    esMenor:      false,
    relacionesConAdultos: [],
  };
}

// CORRECCIÓN PRINCIPAL: eliminamos las claves cuyo valor es undefined/vacío
// antes de enviar, para que el backend no reciba campos nulos inesperados.
export function toClientPayload(g: PartialGuestData): ClientPayload {
  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";
  const nacCod  = NAC_TO_CODPAIS[g.nacionalidad ?? ""] ?? codpais;
  const docCod  = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;

  const raw: Record<string, string | boolean | undefined> = {
    name:        (g.nombre    ?? "").trim() || undefined,
    surname:     (g.apellido  ?? "").trim() || undefined,
    sex:         g.sexo === "Hombre" ? "M" : g.sexo === "Mujer" ? "F" : undefined,
    birth:       g.fechaNac   || undefined,
    nationality: nacCod       || undefined,
    email:       (g.email     ?? "").trim() || undefined,
    phone:       (g.telefono  ?? "").trim() || undefined,
    address:     (g.direccion ?? "").trim() || undefined,
    city:        (g.ciudad    ?? "").trim() || undefined,
    province:    (g.provincia ?? "").trim() || undefined,
    cp:          (g.cp        ?? "").trim() || undefined,
    country:     codpais,
    doc_type:    docCod,
    doc_support: (g.numDoc    ?? "").trim() || undefined,
    vat:         (g.vat       ?? "").trim() || undefined,
  };

  // Eliminar claves undefined para que no lleguen al backend
  const payload: ClientPayload = { name: raw.name as string, surname: raw.surname as string, country: codpais };
  for (const [key, value] of Object.entries(raw)) {
    if (value !== undefined) {
      payload[key] = value;
    }
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

export async function updateClient(clientId: number, guest: PartialGuestData): Promise<void> {
  await apiAuth.put(`/clients/${clientId}`, toClientPayload(guest));
}

export async function validateClient(clientId: number): Promise<void> {
  await apiAuth.patch(`/clients/${clientId}/validate`);
}