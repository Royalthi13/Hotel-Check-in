import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n";
import "@/styles/variables.css";
import "@/styles/base.css";

import "@/components/ui/buttons.css";
import "@/components/ui/forms.css";
import "@/components/ui/alerts.css";
import "@/components/ui/misc.css";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import "flag-icons/css/flag-icons.min.css";
import "dayjs/locale/es";
import "dayjs/locale/en";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
      <App />
    </LocalizationProvider>
  </React.StrictMode>,
);
