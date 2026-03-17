import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // ← vaciado; existe para que Vite no avise de import faltante

// LocalizationProvider al nivel raíz — se monta UNA sola vez, nunca se remonta
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/es';

async function prepare() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      serviceWorker: { url: '/mockServiceWorker.js' },
      onUnhandledRequest: 'warn',
    });
    console.info('[MSW] mocking enabled');
  }
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <App />
      </LocalizationProvider>
    </React.StrictMode>,
  );
});