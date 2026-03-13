import { http, HttpResponse, delay } from 'msw';
import { MOCK_KNOWN_GUEST } from '../constants';

export const handlers = [
  // GET /api/checkin/:token -> Recupera datos iniciales
  http.get('/api/checkin/:token', async ({ params }) => {
    await delay(800); // Simulamos latencia de red real
    
    if (params.token === 'new') {
      return HttpResponse.json({ status: 'new', data: null });
    }
    
    return HttpResponse.json({
      status: 'found',
      data: MOCK_KNOWN_GUEST
    });
  }),

  // POST /api/checkin/:token -> Guarda el progreso o finaliza
  http.post('/api/checkin/:token', async ({ request }) => {
    await delay(1000);
    const body = await request.json();
    return HttpResponse.json({ success: true, savedData: body }, { status: 201 });
  }),

  // POST /api/upload-document -> Simula subida de archivos
  http.post('/api/upload-document', async () => {
    await delay(1500);
    return HttpResponse.json({ url: 'https://cdn.lumina.com/docs/dummy-id.pdf' }, { status: 200 });
  }),
];