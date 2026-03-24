import { http, HttpResponse, delay } from "msw";
import { MOCK_KNOWN_GUEST } from "@/constants";
import { MOCK_RESERVAS } from "./reservas-mock";
import type { GuestData } from "@/types";

// ── Datos pre-rellenados que llegan desde el sistema de reservas ──────────────
//
// En producción, el backend construye este objeto combinando:
//   - Los datos que el cliente introdujo al reservar (nombre, apellido, email/tel)
//   - El perfil almacenado de estancias anteriores (si existe)
//
// Tokens de prueba con huésped conocido (perfil completo de estancia previa):
//   · 99999 → María García  — email bloqueado, tel libre
//   · 78432 → Carlos López  — teléfono bloqueado, email libre
//
// Token sin perfil previo (huésped nuevo, grupo de 5):
//   · 12345 → null  →  flujo manual desde cero

const MOCK_GUESTS: Record<string, GuestData> = {
  // ── Huésped con perfil completo de estancia anterior ─────────────────────
  "99999": {
    ...MOCK_KNOWN_GUEST,
    nombre: "María",
    apellido: "García",
    apellido2: "Fernández",
    sexo: "Mujer",
    fechaNac: "1985-06-15",
    nacionalidad: "Española",
    tipoDoc: "DNI",
    numDoc: "12345678Z",
    soporteDoc: "IDESP12345",
    // Contacto pre-rellenado desde la reserva → se bloquea en form_contacto
    email: "maria.garcia@email.com",
    telefono: "",
    // Dirección de la última estancia
    pais: "España",
    cp: "28001",
    provincia: "Madrid",
    ciudad: "Madrid",
    direccion: "Calle Mayor 15, 3º B",
    esMenor: false,
    relacionesConAdultos: [],
  },

  // ── Huésped con perfil completo, prefirió dar teléfono al reservar ────────
  "78432": {
    ...MOCK_KNOWN_GUEST,
    nombre: "Carlos",
    apellido: "López",
    apellido2: "Sánchez",
    sexo: "Hombre",
    fechaNac: "1978-11-03",
    nacionalidad: "Española",
    tipoDoc: "DNI",
    numDoc: "87654321X",
    soporteDoc: "IDESP98765",
    // Teléfono pre-rellenado desde la reserva → bloqueado; email libre
    email: "",
    telefono: "+34 612 345 678",
    pais: "España",
    cp: "08001",
    provincia: "Barcelona",
    ciudad: "Barcelona",
    direccion: "Passeig de Gràcia 42, 1º",
    esMenor: false,
    relacionesConAdultos: [],
  },
};

// ✨ BASE DE DATOS SIMULADA EN MEMORIA
// Aquí guardaremos los "Guardar y seguir luego" vinculados al token
const partialSavesDB = new Map<string, unknown>();

export const handlers = [
  // ── GET /api/checkin/:token ───────────────────────────────────────────────
  // Devuelve el perfil pre-rellenado si existe, null si es huésped nuevo.
  http.get("/api/checkin/:token", async ({ params }) => {
    await delay(800);
    const token = params.token as string;

    if (token === "new") {
      return HttpResponse.json({ status: "new", data: null, reserva: null });
    }

    const guest = MOCK_GUESTS[token] ?? null;

    // Buscamos la reserva usando directamente el token como clave
    const reserva = MOCK_RESERVAS[token] || null;

    console.log(`[MSW] Buscando reserva para token ${token}:`, reserva);

    return HttpResponse.json({
      status: guest ? "found" : "new",
      data: guest,
      reserva: reserva,
    });
  }),

  // ── GET /api/reservas/:id ─────────────────────────────────────────────────
  // Usado por el kiosko de recepción (tablet_buscar).
  http.get("/api/reservas/:id", async ({ params }) => {
    await delay(600);
    const reserva = MOCK_RESERVAS[params.id as string];
    if (!reserva) {
      return HttpResponse.json(
        {
          ok: false,
          message: "No se encontró ninguna reserva con ese número.",
        },
        { status: 404 },
      );
    }
    return HttpResponse.json({ ok: true, reserva });
  }),

  // ── POST /api/checkin/:token ──────────────────────────────────────────────
  http.post("/api/checkin/:token", async ({ request, params }) => {
    await delay(1000);
    // FIX: Usamos 'unknown' o una interfaz en lugar de 'any' para satisfacer a ESLint
    const body = (await request.json()) as { isPartial?: boolean; [key: string]: unknown };
    const token = params.token as string;

    if (body.isPartial) {
      partialSavesDB.set(token, body);
      console.log("💾 [Mock DB] Progreso guardado para el token:", token);
      return HttpResponse.json(
        { success: true, savedData: body },
        { status: 201 },
      );
    }

    partialSavesDB.delete(token);
    console.log("✅ [Mock DB] Check-in completado. Progreso limpiado.");
    return HttpResponse.json(
      { success: true, savedData: body },
      { status: 201 },
    );
  }),

  // ── POST /api/upload-document ─────────────────────────────────────────────
  http.post("/api/upload-document", async () => {
    await delay(1500);
    return HttpResponse.json(
      { url: "https://cdn.lumina.com/docs/dummy-id.pdf" },
      { status: 200 },
    );
  }),
];