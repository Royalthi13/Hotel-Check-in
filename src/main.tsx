import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";
import "./i18n";

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
