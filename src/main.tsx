import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app.css';

// FIX 2: LocalizationProvider al nivel raíz — se monta UNA sola vez, nunca se remonta
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/es';

// Inicializar MSW en desarrollo
async function prepare() {
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
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