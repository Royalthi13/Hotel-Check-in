
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
 
export const handlers = [
  http.post("/auth/token", async () => {
    await delay(300);
    return HttpResponse.json({ access_token: "mock-dev-token", token_type: "bearer" });
  }),
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
  http.put("/bookings/:id", async ({ params, request }) => {
    await delay(400);
    const booking = BOOKINGS[Number(params.id)];
    if (!booking) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    Object.assign(booking, await request.json());
    return HttpResponse.json(booking);
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
  http.get("/companions/booking/:bookingId", async ({ params }) => {
    await delay(300);
    return HttpResponse.json(companions.filter((c) => c.booking_id === Number(params.bookingId)));
  }),
  http.post("/companions", async ({ request }) => {
    await delay(400);
    const body = await request.json() as { booking_id: number; client_id: number; relationship?: string };
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
  http.get("/cities/name/:name", async ({ params }) => {
    await delay(200);
    // Mock básico - el backend real devolverá los datos reales
    const name = String(params.name).toLowerCase();
    const mockCities = [
      { code: "28079", name: "Madrid",    province: "Madrid",    postal_code: "28001" },
      { code: "08019", name: "Barcelona", province: "Barcelona", postal_code: "08001" },
      { code: "41091", name: "Sevilla",   province: "Sevilla",   postal_code: "41001" },
      { code: "46250", name: "Valencia",  province: "Valencia",  postal_code: "46001" },
      { code: "50297", name: "Zaragoza",  province: "Zaragoza",  postal_code: "50001" },
    ].filter((c) => c.name.toLowerCase().startsWith(name));
    return HttpResponse.json(mockCities);
  }),
  http.get("/cities/:code", async ({ params }) => {
    await delay(200);
    const mockByCP: Record<string, object> = {
      "28001": { code: "28079", name: "Madrid",    province: "Madrid",    postal_code: "28001" },
      "08001": { code: "08019", name: "Barcelona", province: "Barcelona", postal_code: "08001" },
      "41001": { code: "41091", name: "Sevilla",   province: "Sevilla",   postal_code: "41001" },
      "46001": { code: "46250", name: "Valencia",  province: "Valencia",  postal_code: "46001" },
    };
    const city = mockByCP[String(params.code)];
    if (!city) return HttpResponse.json({ detail: "Not found" }, { status: 404 });
    return HttpResponse.json(city);
  }),
  http.get("/countries", () => HttpResponse.json([
    { codpais: "ESP", name: "España",          iso2: "ES" },
    { codpais: "GBR", name: "United Kingdom",  iso2: "GB" },
    { codpais: "FRA", name: "France",           iso2: "FR" },
    { codpais: "DEU", name: "Germany",          iso2: "DE" },
    { codpais: "ITA", name: "Italy",            iso2: "IT" },
    { codpais: "PRT", name: "Portugal",         iso2: "PT" },
  ])),
  http.get("/documents_type", () => HttpResponse.json([
    { coddoc: "DNI",       name: "DNI" },
    { coddoc: "NIE",       name: "NIE" },
    { coddoc: "Pasaporte", name: "Pasaporte" },
    { coddoc: "CIF",       name: "CIF" },
    { coddoc: "Otro",      name: "Otro" },
  ])),
  http.get("/relationships", () => HttpResponse.json([
    { codrelation: "hijo",    name: "Hijo/a" },
    { codrelation: "sobrino", name: "Sobrino/a" },
    { codrelation: "tutor",   name: "Tutor legal" },
    { codrelation: "otro",    name: "Otro" },
  ])),
];
 