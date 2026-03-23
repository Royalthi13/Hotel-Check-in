import { http, HttpResponse, delay } from "msw";
import { MOCK_KNOWN_GUEST } from "@/constants";
import { MOCK_RESERVAS } from "./reservas-mock";

const MOCK_GUESTS: Record<string, typeof MOCK_KNOWN_GUEST> = {
  "99999": {
    ...MOCK_KNOWN_GUEST,
    nombre: "María",
    apellido: "García",
    email: "maria.garcia@email.com", // email bloqueado, teléfono opcional
    telefono: "",
  },
  "78432": {
    ...MOCK_KNOWN_GUEST,
    nombre: "Carlos",
    apellido: "López",
    email: "",
    telefono: "+34 612 345 678",     // teléfono bloqueado, email opcional
  },
};

export const handlers = [
http.get("/api/checkin/:token", async ({ params }) => {
  await delay(800);
  if (params.token === "new") {
    return HttpResponse.json({ status: "new", data: null });
  }
  const guest = MOCK_GUESTS[params.token as string] ?? MOCK_KNOWN_GUEST; // ← usar MOCK_GUESTS
  return HttpResponse.json({ status: "found", data: guest });
}),

http.get("/checkin/kiosko/bienvenida", async () => {
  await delay(500);
  return HttpResponse.json({ ok: true });
}),

http.get("/checkin/kiosko/form_personal", async () => {
  await delay(500);
  return HttpResponse.json({ ok: true });
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
