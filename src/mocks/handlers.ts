// src/mocks/handlers.ts
// Handlers MSW que replican el comportamiento del backend real.
// En producción, estos mocks se bypassan y las llamadas van al servidor.
// En desarrollo (VITE_USE_MOCKS=true), este worker intercepta las peticiones.

import { http, HttpResponse, delay } from "msw";

type ClientRecord    = Record<string, unknown>;
type BookingRecord   = Record<string, unknown>;
type CompanionRecord = { id: number; booking_id: number; client_id: number; relationship?: string };

const CLIENTS: Record<number, ClientRecord> = {
  1: {
    id: 1, name: "María", surname: "García", second_surname: "Fernández",
    gender: "F", birth_date: "1985-06-15", nationality: "Española",
    email: "maria.garcia@email.com", phone: "",
    address: "Calle Mayor 15, 3º B", city: "Madrid", province: "Madrid",
    postal_code: "28001", country: "ES",
    document_type: "DNI", document_number: "12345678Z", support_number: "IDESP12345",
    vat: null, is_minor: false,
  },
  2: {
    id: 2, name: "Carlos", surname: "López", second_surname: "Sánchez",
    gender: "M", birth_date: "1978-11-03", nationality: "Española",
    email: "", phone: "+34 612 345 678",
    address: "Passeig de Gràcia 42, 1º", city: "Barcelona", province: "Barcelona",
    postal_code: "08001", country: "ES",
    document_type: "DNI", document_number: "87654321X", support_number: "IDESP98765",
    vat: null, is_minor: false,
  },
};

const BOOKINGS: Record<number, BookingRecord> = {
  78432: {
    id: 78432, confirmation_number: "#LM-78432",
    check_in: "2025-03-15", check_out: "2025-03-18",
    num_nights: 3, num_guests: 2, client_id: 2, status: "confirmed",
    observations: null, arrival_time: null,
    room: { id: 10, room_number: "201", room_type: { id: 3, name: "Suite Junior Deluxe" } },
  },
  99999: {
    id: 99999, confirmation_number: "#LM-99999",
    check_in: "2025-04-15", check_out: "2025-04-18",
    num_nights: 3, num_guests: 1, client_id: 1, status: "confirmed",
    observations: null, arrival_time: null,
    room: { id: 5, room_number: "105", room_type: { id: 2, name: "Habitación Doble" } },
  },
  12345: {
    id: 12345, confirmation_number: "#LM-12345",
    check_in: "2025-04-15", check_out: "2025-04-18",
    num_nights: 3, num_guests: 5, client_id: null, status: "confirmed",
    observations: null, arrival_time: null,
    room: { id: 7, room_number: "343", room_type: { id: 1, name: "Habitación Estándar" } },
  },
};

let nextClientId    = 100;
let nextCompanionId = 200;
const companions: CompanionRecord[] = [];

// ── Mock ciudades — muestra mínima que replica el schema real (codcity, name) ──
// En desarrollo con el backend levantado, estas rutas no se usan (onUnhandledRequest: bypass).
// Solo actúan si el backend está caído y se quiere probar el UI offline.
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
    await delay(600);
    const booking = BOOKINGS[Number(params.id)];
    if (!booking) return HttpResponse.json({ detail: "Booking not found" }, { status: 404 });
    return HttpResponse.json(booking);
  }),
  http.get("/bookings", async ({ request }) => {
    await delay(600);
    const confNum = new URL(request.url).searchParams.get("confirmation_number");
    if (confNum) {
      const match = Object.values(BOOKINGS).find((b) => b.confirmation_number === confNum);
      return HttpResponse.json(match ? [match] : []);
    }
    return HttpResponse.json(Object.values(BOOKINGS));
  }),
  http.get("/bookings/:id/companions", async ({ params }) => {
    await delay(300);
    const bookingId = Number(params.id);
    return HttpResponse.json(companions.filter((c) => c.booking_id === bookingId));
  }),
  http.put("/bookings/:id", async ({ params, request }) => {
    await delay(400);
    const booking = BOOKINGS[Number(params.id)];
    if (!booking) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    Object.assign(booking, await request.json());
    return HttpResponse.json(booking);
  }),

  // ── Clients ──────────────────────────────────────────────────────────────────
  http.get("/clients/search", async ({ request }) => {
    await delay(300);
    const q = new URL(request.url).searchParams.get("q")?.toLowerCase() ?? "";
    const results = Object.values(CLIENTS).filter(
      (c) =>
        String(c.name).toLowerCase().includes(q) ||
        String(c.surname).toLowerCase().includes(q) ||
        String(c.document_number).toLowerCase().includes(q),
    );
    return HttpResponse.json(results);
  }),
  http.get("/clients/:id", async ({ params }) => {
    await delay(400);
    const client = CLIENTS[Number(params.id)];
    if (!client) return HttpResponse.json({ detail: "Client not found" }, { status: 404 });
    return HttpResponse.json(client);
  }),
  http.post("/clients", async ({ request }) => {
    await delay(500);
    const body = await request.json() as Record<string, unknown>;
    const newClient = { id: nextClientId++, is_minor: false, ...body };
    CLIENTS[newClient.id] = newClient;
    return HttpResponse.json(newClient, { status: 201 });
  }),
  http.put("/clients/:id", async ({ params, request }) => {
    await delay(400);
    const id = Number(params.id);
    if (!CLIENTS[id]) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    Object.assign(CLIENTS[id], await request.json());
    return HttpResponse.json(CLIENTS[id]);
  }),
  http.patch("/clients/:id/validate", async ({ params }) => {
    await delay(300);
    const id = Number(params.id);
    if (!CLIENTS[id]) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    return HttpResponse.json({ ...CLIENTS[id], validated: true });
  }),
  http.delete("/clients/:id", async ({ params }) => {
    await delay(300);
    delete CLIENTS[Number(params.id)];
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Companions ───────────────────────────────────────────────────────────────
  http.get("/companions/booking/:bookingId", async ({ params }) => {
    await delay(300);
    return HttpResponse.json(
      companions.filter((c) => c.booking_id === Number(params.bookingId)),
    );
  }),
  http.post("/companions", async ({ request }) => {
    await delay(400);
    const body = await request.json() as {
      booking_id: number;
      client_id: number;
      relationship?: string;
    };
    const newCompanion: CompanionRecord = { id: nextCompanionId++, ...body };
    companions.push(newCompanion);
    return HttpResponse.json(newCompanion, { status: 201 });
  }),
  http.delete("/companions/:id", async ({ params }) => {
    await delay(300);
    const idx = companions.findIndex((c) => c.id === Number(params.id));
    if (idx !== -1) companions.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Cities — schema real: { codcity, name } ──────────────────────────────────
  // IMPORTANTE: /cities/name/:name debe ir ANTES de /cities/:code
  http.get("/cities/name/:name", async ({ params }) => {
    await delay(150);
    const search = String(params.name).toLowerCase();
    const results = MOCK_CITIES.filter((c) =>
      c.name.toLowerCase().includes(search),
    );
    return results.length > 0
      ? HttpResponse.json(results)
      : new HttpResponse(null, { status: 204 });
  }),
  http.get("/cities/:code", async ({ params }) => {
    await delay(200);
    const code = String(params.code);
    const city = MOCK_CITIES.find((c) => c.codcity === code);
    if (!city) return HttpResponse.json({ detail: "Ciudad no encontrada" }, { status: 404 });
    return HttpResponse.json(city);
  }),

  // ── Countries ────────────────────────────────────────────────────────────────
  http.get("/countries/name/:name", async () => {
    await delay(150);
    return HttpResponse.json([]);
  }),
  http.get("/countries", () =>
    HttpResponse.json([
      { codpais: "ESP", name: "España",          iso2: "ES" },
      { codpais: "GBR", name: "United Kingdom",  iso2: "GB" },
      { codpais: "FRA", name: "France",           iso2: "FR" },
      { codpais: "DEU", name: "Germany",          iso2: "DE" },
      { codpais: "ITA", name: "Italy",            iso2: "IT" },
      { codpais: "PRT", name: "Portugal",         iso2: "PT" },
      { codpais: "USA", name: "United States",    iso2: "US" },
      { codpais: "MEX", name: "México",           iso2: "MX" },
      { codpais: "ARG", name: "Argentina",        iso2: "AR" },
    ]),
  ),

  // ── Catalogs ─────────────────────────────────────────────────────────────────
  http.get("/documents_type", () =>
    HttpResponse.json([
      { coddoc: "DNI",       name: "DNI" },
      { coddoc: "NIE",       name: "NIE" },
      { coddoc: "Pasaporte", name: "Pasaporte" },
      { coddoc: "CIF",       name: "CIF" },
      { coddoc: "Otro",      name: "Otro" },
    ]),
  ),
  http.get("/relationships", () =>
    HttpResponse.json([
      { codrelation: "hijo",    name: "Hijo/a" },
      { codrelation: "sobrino", name: "Sobrino/a" },
      { codrelation: "tutor",   name: "Tutor legal" },
      { codrelation: "otro",    name: "Otro" },
    ]),
  ),

  // ── Room Status / Type ────────────────────────────────────────────────────────
  http.get("/room_status", () =>
    HttpResponse.json([
      { id: 1, name: "Disponible" },
      { id: 2, name: "Ocupada" },
      { id: 3, name: "Limpieza" },
      { id: 4, name: "Mantenimiento" },
    ]),
  ),
  http.get("/room_type", () =>
    HttpResponse.json([
      { id: 1, name: "Habitación Estándar" },
      { id: 2, name: "Habitación Doble" },
      { id: 3, name: "Suite Junior" },
      { id: 4, name: "Suite" },
    ]),
  ),
];