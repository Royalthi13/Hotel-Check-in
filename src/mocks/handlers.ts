// src/mocks/handlers.ts
// Handlers MSW que replican el comportamiento del backend real.
//
// FIX CRÍTICO: el esquema de CLIENTS y BOOKINGS estaba completamente equivocado.
//
// CLIENTS antes: birth_date, gender, document_type, document_number, support_number,
//                postal_code, country: "ES", nationality: "Española"
// CLIENTS ahora: birth, sex, doc_type, vat (=DNI), doc_support (=soporte),
//                cp, country: "ESP" (codpais), nationality: "ESP" (codpais)
//
// BOOKINGS antes: num_guests, confirmation_number, num_nights, room (objeto anidado)
// BOOKINGS ahora: persons, room_name, pre_checking, status_id, status_name, client_name…

import { http, HttpResponse, delay } from "msw";

type ClientRecord    = Record<string, unknown>;
type BookingRecord   = Record<string, unknown>;
type CompanionRecord = { id: number; booking_id: number; client_id: number };

// ── Clientes con schema real del backend (ClientInDB) ─────────────────────────
//
// Columnas relevantes para el frontend:
//   name, surname (apellido1+apellido2 concatenados), sex, birth ("YYYY-MM-DD"),
//   nationality (codpais FK), country (codpais FK),
//   vat (número del DNI/NIE/PAS),
//   doc_type (coddoc: NIF|NIE|CIF|OTRO|PAS),
//   doc_support (número de soporte del carné),
//   cp (código postal), email, phone, address, city, province
//
const CLIENTS: Record<number, ClientRecord> = {
  1: {
    id: 1,
    name: "María",
    surname: "García Fernández",   // concatenado
    sex: "F",
    birth: "1985-06-15",           // "YYYY-MM-DD" — NOT "birth_date"
    nationality: "ESP",            // codpais — NOT "Española"
    email: "maria.garcia@email.com",
    phone: "",
    address: "Calle Mayor 15, 3º B",
    city: "Madrid",
    province: "Madrid",
    cp: "28001",                   // NOT "postal_code"
    country: "ESP",                // codpais — NOT "ES"
    doc_type: "NIF",               // coddoc — NOT "DNI" / NOT "document_type"
    vat: "12345678Z",              // número DNI — NOT "document_number"
    doc_support: "IDESP12345",     // número soporte — NOT "support_number"
    relationship: null,
    cod_city: null,
    observations: null,
    validated_at: null,
    pre_checkin_send: null,
  },
  2: {
    id: 2,
    name: "Carlos",
    surname: "López Sánchez",      // concatenado
    sex: "M",
    birth: "1978-11-03",
    nationality: "ESP",
    email: "",
    phone: "+34 612 345 678",
    address: "Passeig de Gràcia 42, 1º",
    city: "Barcelona",
    province: "Barcelona",
    cp: "08001",
    country: "ESP",
    doc_type: "NIF",
    vat: "87654321X",
    doc_support: "IDESP98765",
    relationship: null,
    cod_city: null,
    observations: null,
    validated_at: null,
    pre_checkin_send: null,
  },
};

// ── Reservas con schema real del backend (BookingSearch) ──────────────────────
//
// BookingSearch es una vista con JOINs — lo que devuelve GET /bookings/{id}.
// El frontend usa: room_name, persons, pre_checking, client_id, check_in, check_out.
//
const BOOKINGS: Record<number, BookingRecord> = {
  78432: {
    id: 78432,
    room_id: 10,
    room_name: "Suite Junior Deluxe 201",   // campo plano, no objeto anidado
    check_in: "2025-03-15",
    check_out: "2025-03-18",
    client_id: 2,
    client_name: "Carlos",
    client_surname: "López Sánchez",
    status_id: 1,
    status_name: "Confirmada",
    persons: 2,                             // NOT "num_guests"
    notes: null,
    source: null,
    pay_type: null,
    pay_date: null,
    pay_num: null,
    pay_titular: null,
    card_cad: null,
    pre_checking: false,                    // false = no completado aún
    communication: null,
    created_at: "2025-01-10T10:00:00",
  },
  99999: {
    id: 99999,
    room_id: 5,
    room_name: "Habitación Doble 105",
    check_in: "2025-04-15",
    check_out: "2025-04-18",
    client_id: 1,
    client_name: "María",
    client_surname: "García Fernández",
    status_id: 1,
    status_name: "Confirmada",
    persons: 1,
    notes: null,
    source: null,
    pay_type: null,
    pay_date: null,
    pay_num: null,
    pay_titular: null,
    card_cad: null,
    pre_checking: false,
    communication: null,
    created_at: "2025-01-15T09:30:00",
  },
  12345: {
    id: 12345,
    room_id: 7,
    room_name: "Habitación Estándar 343",
    check_in: "2025-04-15",
    check_out: "2025-04-18",
    client_id: null,
    client_name: null,
    client_surname: null,
    status_id: 1,
    status_name: "Confirmada",
    persons: 5,
    notes: null,
    source: null,
    pay_type: null,
    pay_date: null,
    pay_num: null,
    pay_titular: null,
    card_cad: null,
    pre_checking: false,
    communication: null,
    created_at: "2025-01-20T14:00:00",
  },
};

let nextClientId    = 100;
let nextCompanionId = 200;
const companions: CompanionRecord[] = [];

// ── Mock ciudades — schema real: { codcity, name } ────────────────────────────
const MOCK_CITIES = [
  { codcity: "28079", name: "Madrid" },
  { codcity: "28016", name: "Majadahonda" },
  { codcity: "08019", name: "Barcelona" },
  { codcity: "41091", name: "Sevilla" },
  { codcity: "46250", name: "Valencia" },
  { codcity: "50297", name: "Zaragoza" },
  { codcity: "29067", name: "Málaga" },
  { codcity: "48020", name: "Bilbao" },
];

export const handlers = [

  // ── Auth ────────────────────────────────────────────────────────────────────
  http.post("/auth/token", async () => {
    await delay(300);
    return HttpResponse.json({ access_token: "mock-dev-token-jwt", token_type: "bearer" });
  }),

  // ── Bookings ─────────────────────────────────────────────────────────────────
  http.get("/bookings/:id", async ({ params }) => {
    await delay(400);
    const booking = BOOKINGS[Number(params.id)];
    if (!booking) return HttpResponse.json({ detail: "Booking not found" }, { status: 404 });
    return HttpResponse.json(booking);
  }),

  http.get("/bookings", async ({ request }) => {
    await delay(400);
    const url     = new URL(request.url);
    const confNum = url.searchParams.get("confirmation_number");
    if (confNum) {
      const match = Object.values(BOOKINGS).find((b) => b.id === parseInt(confNum, 10));
      return HttpResponse.json(match ? [match] : []);
    }
    return HttpResponse.json(Object.values(BOOKINGS));
  }),

  http.put("/bookings/:id", async ({ params, request }) => {
    await delay(300);
    const booking = BOOKINGS[Number(params.id)];
    if (!booking) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    Object.assign(booking, await request.json());
    return HttpResponse.json(booking);
  }),

  // ── Clients ──────────────────────────────────────────────────────────────────
  http.get("/clients/:id", async ({ params }) => {
    await delay(300);
    const client = CLIENTS[Number(params.id)];
    if (!client) return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
    return HttpResponse.json(client);
  }),

  http.post("/clients", async ({ request }) => {
    await delay(400);
    const body      = await request.json() as Record<string, unknown>;
    const newClient = { id: nextClientId++, ...body };
    CLIENTS[newClient.id as number] = newClient;
    return HttpResponse.json(newClient, { status: 201 });
  }),

  http.put("/clients/:id", async ({ params, request }) => {
    await delay(300);
    const id = Number(params.id);
    if (!CLIENTS[id]) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    Object.assign(CLIENTS[id], await request.json());
    return HttpResponse.json(CLIENTS[id]);
  }),

  http.patch("/clients/:id/validate", async ({ params }) => {
    await delay(200);
    const id = Number(params.id);
    if (!CLIENTS[id]) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    return HttpResponse.json({ ...CLIENTS[id], validated_at: new Date().toISOString() });
  }),

  http.delete("/clients/:id", async ({ params }) => {
    await delay(200);
    delete CLIENTS[Number(params.id)];
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Companions ───────────────────────────────────────────────────────────────
  http.get("/companions/booking/:bookingId", async ({ params }) => {
    await delay(200);
    const bookingId = Number(params.bookingId);
    const result    = companions.filter((c) => c.booking_id === bookingId);
    // 204 si no hay acompañantes (igual que el backend real)
    if (result.length === 0) return new HttpResponse(null, { status: 204 });
    return HttpResponse.json(result);
  }),

  http.post("/companions", async ({ request }) => {
    await delay(300);
    const body        = await request.json() as { booking_id: number; client_id: number };
    const client      = CLIENTS[body.client_id] ?? {};
    const newCompanion: CompanionRecord & Record<string, unknown> = {
      id:             nextCompanionId++,
      booking_id:     body.booking_id,
      client_id:      body.client_id,
      client_name:    String(client.name ?? ""),
      client_surname: String(client.surname ?? ""),
    };
    companions.push(newCompanion as CompanionRecord);
    return HttpResponse.json(newCompanion, { status: 201 });
  }),

  http.delete("/companions/:id", async ({ params }) => {
    await delay(200);
    const idx = companions.findIndex((c) => c.id === Number(params.id));
    if (idx !== -1) companions.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Cities — schema real: { codcity, name } ───────────────────────────────
  // IMPORTANTE: /cities/name/:name ANTES de /cities/:code (Express-style routing)
  http.get("/cities/name/:name", async ({ params }) => {
    await delay(100);
    const search  = String(params.name).toLowerCase();
    const results = MOCK_CITIES.filter((c) =>
      c.name.toLowerCase().includes(search),
    );
    return results.length > 0
      ? HttpResponse.json(results)
      : new HttpResponse(null, { status: 204 });
  }),

  http.get("/cities/:code", async ({ params }) => {
    await delay(150);
    const code = String(params.code);
    const city = MOCK_CITIES.find((c) => c.codcity === code);
    if (!city) return HttpResponse.json({ detail: "Ciudad no encontrada" }, { status: 404 });
    return HttpResponse.json(city);
  }),

  // ── Countries — schema real: { codpais, name } — SIN iso2 ────────────────
  http.get("/countries", () =>
    HttpResponse.json([
      { codpais: "ESP", name: "España"          },
      { codpais: "GBR", name: "United Kingdom"  },
      { codpais: "FRA", name: "France"           },
      { codpais: "DEU", name: "Germany"          },
      { codpais: "ITA", name: "Italy"            },
      { codpais: "PRT", name: "Portugal"         },
      { codpais: "USA", name: "United States"    },
      { codpais: "MEX", name: "México"           },
      { codpais: "ARG", name: "Argentina"        },
    ]),
  ),

  // ── Catálogos ─────────────────────────────────────────────────────────────
  // document_type: valores reales = CIF, NIE, NIF, OTRO, PAS
  http.get("/documents_type", () =>
    HttpResponse.json([
      { coddoc: "NIF",  name: "DNI / NIF" },
      { coddoc: "NIE",  name: "NIE" },
      { coddoc: "PAS",  name: "Pasaporte" },
      { coddoc: "CIF",  name: "CIF" },
      { coddoc: "OTRO", name: "Otro" },
    ]),
  ),

  // relationship: valores reales = hijo, sobrino, tutor, otro
  http.get("/relationships", () =>
    HttpResponse.json([
      { codrelation: "hijo",    name: "Hijo/a" },
      { codrelation: "sobrino", name: "Sobrino/a" },
      { codrelation: "tutor",   name: "Tutor legal" },
      { codrelation: "otro",    name: "Otro" },
    ]),
  ),
];