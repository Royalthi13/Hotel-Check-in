import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// "bypass" → cualquier petición sin handler (APIs externas, geocoding, etc.)
// se deja pasar al network real en lugar de bloquearse.
// Cuando exista el backend real, simplemente añade sus rutas a handlers.ts.
worker.start({
  onUnhandledRequest: "bypass",
});