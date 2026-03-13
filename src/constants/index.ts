// ─── NOTA: MOCK_RESERVAS movido a /mocks/mockData.ts (FIX 17) ─────────────────
// constants/index.ts solo contiene constantes reales de la app.

import type { GuestData, StepId } from "../types";

export const COLORS = {
  primary: "#fa865c",
  primaryD: "#e5704a",
  primaryLt: "#fef0ea",
  secondary: "#324154",
  secMid: "#4a5a6e",
  secLt: "#6a7a8e",
  bg: "#e5e2dd",
  bgDark: "#23150f",
  white: "#ffffff",
  border: "#d0cbc4",
  borderLt: "#e8e4de",
  text: "#1e2c3a",
  textMid: "#4a5a6a",
  textLow: "#8a9aaa",
  ok: "#2d7a50",
  okBg: "#edf7f1",
  err: "#c0392b",
  errBg: "#fdf2f2",
} as const;

export const MOCK_KNOWN_GUEST: GuestData = {
  nombre: "Carlos",
  apellido: "García",
  apellido2: "López",
  sexo: "Hombre",
  fechaNac: "1985-03-22",
  nacionalidad: "Española",
  email: "carlos.garcia@email.es",
  telefono: "+34 612 345 678",
  direccion: "Calle Mayor, 42, 3.º A",
  ciudad: "Madrid",
  provincia: "Madrid",
  cp: "28001",
  pais: "España",
  tipoDoc: "DNI",
  numDoc: "12345678A",
  vat: "",
};

export const PAISES = [
  "España",
  "Reino Unido",
  "Francia",
  "Alemania",
  "Italia",
  "Países Bajos",
  "Bélgica",
  "Portugal",
  "Irlanda",
  "Estados Unidos",
  "Suiza",
  "Suecia",
  "Noruega",
  "Dinamarca",
  "Austria",
  "Polonia",
  "Finlandia",
  "México",
  "Argentina",
  "Colombia",
];

export const NACIONALIDADES = [
  "Española",
  "Alemana",
  "Francesa",
  "Italiana",
  "Portuguesa",
  "Inglesa",
  "Estadounidense",
  "Argentina",
  "Mexicana",
  "Otra",
];

export const TIPOS_DOCUMENTO = [
  "DNI",
  "NIF",
  "CIF",
  "Pasaporte",
  "NIE",
  "Carnet de conducir",
  "Otro",
];

export const HORAS_LLEGADA = [
  "No especificada",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
  "Después de medianoche",
];

export const SEXOS = ["Hombre", "Mujer", "No indicar"];
export const RELACIONES_MENOR = ["Hijo/a", "Sobrino/a", "Tutor legal", "Otra"];

export const FLOW_STEPS_LINK: StepId[] = [
  "bienvenida",
  "num_personas",
  "escanear",
  "form_personal",
  "form_contacto",
  "form_documento",
  "form_extras",
  "revision",
  "exito",
];

export const DOT_STEPS_BASE: StepId[] = [
  "bienvenida",
  "num_personas",
  "form_personal",
  "form_contacto",
  "form_documento",
  "form_extras",
  "revision",
  "exito",
];

export const DOT_LABELS: Partial<Record<StepId, string>> = {
  bienvenida: "Bienvenida",
  num_personas: "Personas",
  form_personal: "Datos personales",
  form_contacto: "Contacto",
  form_documento: "Documento",
  form_extras: "Preferencias",
  revision: "Revisión",
  exito: "Completado",
};
