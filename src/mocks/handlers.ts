import { http, HttpResponse, delay } from 'msw';
import { MOCK_KNOWN_GUEST } from '../constants';
import { MOCK_RESERVAS } from './reservas-mock'; // datos aquí, el handler solo los usa

export const handlers = [
  // GET /api/checkin/:token — carga datos del cliente por token de email
  http.get('/api/checkin/:token', async ({ params }) => {
    await delay(800);
    if (params.token === 'new') {
      return HttpResponse.json({ status: 'new', data: null });
    }
    return HttpResponse.json({ status: 'found', data: MOCK_KNOWN_GUEST });
  }),

  // GET /api/reservas/:id — busca reserva por número (modo tablet)
  http.get('/api/reservas/:id', async ({ params }) => {
    await delay(600);
    const reserva = MOCK_RESERVAS[params.id as string];
    if (!reserva) {
      return HttpResponse.json(
        { ok: false, message: 'No se encontró ninguna reserva con ese número.' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ ok: true, reserva });
  }),

  // POST /api/checkin/:token — envía el formulario completo
  http.post('/api/checkin/:token', async ({ request }) => {
    await delay(1000);
    const body = await request.json();
    return HttpResponse.json({ success: true, savedData: body }, { status: 201 });
  }),

  // POST /api/upload-document — sube foto del documento
  http.post('/api/upload-document', async () => {
    await delay(1500);
    return HttpResponse.json(
      { url: 'https://cdn.lumina.com/docs/dummy-id.pdf' },
      { status: 200 },
    );
  }),
];

// MOCK_RESERVAS deliberadamente NO se reexporta desde aquí.
// Si lo necesitas fuera de mocks/, impórtalo desde './reservas-mock' directamente.