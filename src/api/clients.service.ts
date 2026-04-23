import { apiAuth } from "./axiosInstance";
import dayjs from "dayjs";
import type { GuestData, PartialGuestData } from "@/types";
import { splitSurnames } from "@/utils/surnames";

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
// ── Mapeos inversos DB → Frontend ─────────────────────────────────────────────
// Los 3 mapeos principales (ISO2, NAC, DOC) ya están arriba — construimos los
// inversos a partir de ellos para que un solo cambio actualice ambos sentidos.
const CODPAIS_TO_ISO2: Record<string, string> = Object.fromEntries(
  Object.entries(ISO2_TO_CODPAIS).map(([iso2, codpais]) => [codpais, iso2]),
);
const CODPAIS_TO_NAC: Record<string, string> = Object.fromEntries(
  Object.entries(NAC_TO_CODPAIS).map(([nac, codpais]) => [codpais, nac]),
);
const COD_TO_DOC: Record<string, string> = {
  NIF: "DNI", NIE: "NIE", CIF: "CIF", PAS: "Pasaporte", OTRO: "Otro",
};
// Nota: el parentesco NO se mapea — la API devuelve y acepta el mismo
// `codrelation` (ej: "HJ", "TU", "PM", "OT") que el frontend guarda en el
// state. ScreenRelacionesMenor.tsx lo rellena del dropdown de la API,
// y ScreenRevision.tsx lo traduce vía t('parentescos.${codrelation}').

// ── DB → GuestData ─────────────────────────────────────────────────────────────
export function toGuestData(c: ClientResponse): GuestData {
  const esMenor = c.birth ? dayjs().diff(dayjs(c.birth), "years") < 18 : false;
  const { apellido, apellido2 } = splitSurnames(c.surname);

  return {
    id: c.id,
    nombre:    c.name    ?? "",
    apellido: apellido,
    apellido2: apellido2,
    sexo:      c.sex === "M" ? "Hombre" : c.sex === "F" ? "Mujer" : "No indicar",
    fechaNac:  c.birth   ?? "",

    // codpais ("ESP") → ISO2 ("ES") para el selector del frontend
    pais:         CODPAIS_TO_ISO2[c.country ?? ""] ?? "ES",
    // codpais → label de nacionalidad ("ESP" → "Española"), fallback "Otra"
    nacionalidad: CODPAIS_TO_NAC[c.nationality ?? ""] ?? "Otra",
    // "NIF" → "DNI", "PAS" → "Pasaporte", etc.
    tipoDoc:      COD_TO_DOC[c.doc_type ?? ""] ?? "DNI",

    email:     c.email    ?? "",
    telefono:  c.phone    ?? "",
    direccion: c.address  ?? "",
    ciudad:    c.city     ?? "",
    codCity:   c.cod_city ?? "",
    provincia: c.province ?? "",
    cp:        c.cp       ?? "",

    // vat (columna BD) → numDoc (número del documento)
    numDoc:     c.vat         ?? "",
    soporteDoc: c.doc_support ?? "",
    esMenor,
// La API devuelve codrelation (ej: "HJ", "TU") — lo guardamos tal cual.
    // La UI y la traducción trabajan con los mismos códigos.
    relacionesConAdultos: c.relationship
      ? [{ adultoIndex: 0, parentesco: c.relationship }]
      : [],
  };
}// ── GuestData → payload API ────────────────────────────────────────────────────
export function toClientPayload(g: PartialGuestData): Record<string, unknown> {
  const str = (v: string | undefined | null) => v?.trim() || null;
  const esMenor = !!g.esMenor;

  // Para menores se anula contacto (email/teléfono).
  // La dirección puede venir vacía o copiada del adulto en checkin.service.ts.

  const codpais = ISO2_TO_CODPAIS[g.pais ?? "ES"] ?? "ESP";
  const nacCod =
    g.nacionalidad && g.nacionalidad !== "Otra"
      ? (NAC_TO_CODPAIS[g.nacionalidad] ?? codpais)
      : codpais;
  const docCod = DOC_TO_COD[g.tipoDoc ?? ""] ?? undefined;

  const apellido1 = (g.apellido  ?? "").trim();
  const apellido2 = (g.apellido2 ?? "").trim();
  const surname   = [apellido1, apellido2].filter(Boolean).join(" ");
// El parentesco ya viene como codrelation de la API (ej: "HJ", "TU", "OT").
  // Si checkin.service.ts sobrescribió con `parentescoParaAPI` (relación invertida
  // para el adulto, ej: "PM"), ése tiene prioridad.
  const withApiField = g as PartialGuestData & { parentescoParaAPI?: string };
  const codrelation =
    withApiField.parentescoParaAPI
    ?? g.relacionesConAdultos?.[0]?.parentesco
    ?? undefined;

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
address:     str(g.direccion) ?? null,
    city:        str(g.ciudad) ?? null,
    province:    str(g.provincia) ?? null,
    cp:          str(g.cp) ?? null,

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
