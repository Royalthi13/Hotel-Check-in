import { http, HttpResponse, delay } from "msw";
import { MOCK_KNOWN_GUEST } from "@/constants";
import { MOCK_RESERVAS } from "./reservas-mock";

export const handlers = [
  http.get("/api/checkin/:token", async ({ params }) => {
    await delay(800);
    if (params.token === "new") {
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

  http.post("/api/checkin/:token", async ({ request }) => {
    await delay(1000);
    const body = await request.json();
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
