// api/api.types.ts
//
// Tipos sincronizados con el OpenAPI real del backend FastAPI.
// Este archivo es INFORMATIVO — los servicios usan interfaces locales propias.
// Solo debe importarse si necesitas referenciar un tipo desde fuera de su servicio.
//
// IMPORTANTE: las interfaces del backend NO coinciden con las del frontend GuestData.
// La conversión se hace en clients.service.ts → toGuestData / toClientPayload.

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface TokenResponse {
  access_token: string;
  token_type:   "bearer";
}

// ── Bookings ──────────────────────────────────────────────────────────────────
// Lo que devuelve GET /bookings y GET /bookings/{id} — vista con JOINs.
// BookingInDB (sin JOINs) solo aparece en POST/PUT response.
export interface BookingSearch {
  id:           number;
  room_id:      number;
  room_name:    string;
  check_in:     string;   // "YYYY-MM-DD"
  check_out:    string;   // "YYYY-MM-DD"
  client_id:    number;
  client_name:  string;
  client_surname: string;
  status_id:    number;
  status_name:  string;
  persons:      number;
  notes:        string | null;
  source:       string | null;
  pay_type:     string | null;
  pay_date:     string | null;
  pay_num:      string | null;
  pay_titular:  string | null;
  card_cad:     string | null;
  pre_checking: boolean;
  communication: string | null;
  created_at:   string | null;
}

// PUT /bookings/{id} requiere TODOS estos campos (ninguno es opcional en BookingUpdate)
export interface BookingUpdate {
  room_id:      number;
  check_in:     string;
  check_out:    string;
  client_id:    number;
  status_id:    number;
  persons:      number;
  notes:        string | null;
  source:       string | null;
  pay_type:     string | null;
  pay_date:     string | null;
  pay_num:      string | null;
  pay_titular:  string | null;
  card_cad:     string | null;
  pre_checking: boolean;
}

// ── Clients ───────────────────────────────────────────────────────────────────
// Schema real ClientInDB — NO tiene second_surname, gender, birth_date,
// postal_code, document_number, support_number, is_minor.
// Las diferencias con el esquema anterior causaban 422 Unprocessable Entity.
export interface ClientInDB {
  id:               number;
  name:             string;
  surname:          string;         // apellido1 + apellido2 concatenados
  address:          string | null;
  city:             string | null;
  cod_city:         string | null;  // FK → cities.codcity
  province:         string | null;
  cp:               string | null;
  country:          string;         // FK → countries.codpais  (ej: "ESP")
  nationality:      string | null;  // FK → countries.codpais
  vat:              string | null;
  phone:            string | null;
  email:            string | null;
  observations:     string | null;
  doc_type:         string | null;  // FK → document_type.coddoc  (NIF|NIE|CIF|OTRO|PAS)
  doc_support:      string | null;  // número del documento (numDoc del frontend)
  birth:            string | null;  // "YYYY-MM-DD"
  relationship:     string | null;  // FK → relationship.codrelation  (hijo|sobrino|tutor|otro)
  sex:              string | null;  // "M" | "F"
  validated_at:     string | null;
  pre_checkin_send: string | null;
}

// ── Companions ────────────────────────────────────────────────────────────────
// GET /companions/booking/{id} devuelve CompanionSearch (vista con JOIN)
export interface CompanionSearch {
  id:             number;
  booking_id:     number;
  client_id:      number;
  client_name:    string;
  client_surname: string;
}

// POST /companions acepta solo { booking_id, client_id } — NO tiene relationship
export interface CompanionBase {
  booking_id: number;
  client_id:  number;
}

// ── Catálogos ─────────────────────────────────────────────────────────────────
// countries: solo codpais y name — SIN columna iso2
export interface CountryInDB {
  codpais: string;
  name:    string;
}

// document_type — valores reales: CIF, NIE, NIF, OTRO, PAS
export interface DocumentTypeInDB {
  coddoc: string;
  name:   string;
}

// relationship — valores reales: hijo, sobrino, tutor, otro
export interface RelationshipInDB {
  codrelation: string;
  name:        string;
}

// cities
export interface CityInDB {
  codcity: string;
  name:    string;
}