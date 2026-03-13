// ─── Modos de entrada ────────────────────────────────────────────────────────
export type AppMode = 'link' | 'tablet';

// ─── Pasos del flujo ──────────────────────────────────────────────────────────
export type StepId =
  | 'tablet_buscar'
  | 'bienvenida'
  | 'num_personas'
  | 'confirmar_datos'
  | 'escanear'
  | 'form_personal'
  | 'form_contacto'
  | 'form_documento'
  | 'form_extras'
  | 'revision'
  | 'exito';

// ─── Reserva ──────────────────────────────────────────────────────────────────
export interface Reserva {
  confirmacion: string;
  habitacion: string;
  fechaEntrada: string;
  fechaSalida: string;
  numHuespedes: number;
  numNoches: number;
}

// ─── Datos de un huésped ──────────────────────────────────────────────────────
export interface GuestData {
  nombre: string;
  apellido: string;
  apellido2: string;
  sexo: string;
  fechaNac: string;
  nacionalidad: string;
  tienesMenor?: boolean;
  nombreMenor?: string;
  relacionMenor?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  cp?: string;
  pais?: string;
  tipoDoc: string;
  numDoc: string;
  vat?: string;
  // FIX 1: docFile nunca se serializa — solo docUploaded persiste
  docFile?: File | null;
  docUploaded?: boolean;
}

export type PartialGuestData = Partial<GuestData>;

// ─── Datos globales del checkin ───────────────────────────────────────────────
export interface CheckinState {
  appMode: AppMode;
  reserva: Reserva | null;
  knownGuest: GuestData | null;
  numPersonas: number;
  guests: PartialGuestData[];
  horaLlegada: string;
  observaciones: string;
  // FIX 14: RGPD persiste en estado global — sobrevive al botón Atrás
  rgpdAcepted: boolean;
}

// ─── Errores de validación ────────────────────────────────────────────────────
export type FormErrors = Record<string, string>;

// ─── Dirección de navegación ──────────────────────────────────────────────────
export type NavDirection = 'forward' | 'back';