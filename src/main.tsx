import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // ← vaciado; existe para que Vite no avise de import faltante
import "./i18n";
import "@/Buttons.css";
import "@/Forms.css";
import "@/Alerts.css";
import "@/Misc.css";
// LocalizationProvider al nivel raíz — se monta UNA sola vez, nunca se remonta
import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "flag-icons/css/flag-icons.min.css";
import "dayjs/locale/es";
import "dayjs/locale/en";

async function prepare() {
  if (import.meta.env.DEV) {
    const { worker } = await import("./mocks/browser");
    await worker.start({
      serviceWorker: { url: "/mockServiceWorker.js" },
      onUnhandledRequest(req, print) {
        const url = new URL(req.url);
        // Solo avisar por requests de API no mockeados.
        if (url.pathname.startsWith("/api/")) print.warning();
      },
    });
    console.info("[MSW] mocking enabled");
  }
}

prepare().then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
        <App />
      </LocalizationProvider>
    </React.StrictMode>,
  );
});
