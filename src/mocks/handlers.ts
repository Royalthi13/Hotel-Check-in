import { http, HttpResponse, delay } from "msw";
import { MOCK_KNOWN_GUEST } from "@/constants";
import { MOCK_RESERVAS } from "./reservas-mock";
import type { CheckinState } from "@/types";

// ✨ BASE DE DATOS SIMULADA EN MEMORIA
// Aquí guardaremos los "Guardar y seguir luego" vinculados al token
const partialSavesDB = new Map<string, CheckinState>();

export const handlers = [
  // 1. RECUPERAR DATOS AL ABRIR EL ENLACE
  http.get("/api/checkin/:token", async ({ params }) => {
    await delay(800);
    const token = params.token as string;

    if (partialSavesDB.has(token)) {
      return HttpResponse.json({
        status: "partial_recovery",
        state: partialSavesDB.get(token),
      });
    }

    if (token === "new") {
      return HttpResponse.json({ status: "new", data: null });
    }
    return HttpResponse.json({ status: "found", data: MOCK_KNOWN_GUEST });
  }),

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

  http.post("/api/checkin/:token", async ({ request, params }) => {
    await delay(1000);
    const body = (await request.json()) as any;
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

  http.post("/api/upload-document", async () => {
    await delay(1500);
    return HttpResponse.json(
      { url: "https://cdn.lumina.com/docs/dummy-id.pdf" },
      { status: 200 },
    );
  }),
];
