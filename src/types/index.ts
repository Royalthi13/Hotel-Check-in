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
  // Personal
  nombre: string;
  apellido: string;
  apellido2: string;
  sexo: string;
  fechaNac: string;
  nacionalidad: string;
  // Menor acompañante (solo huésped principal)
  tienesMenor?: boolean;
  nombreMenor?: string;
  relacionMenor?: string;
  // Contacto (solo huésped principal)
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  provincia?: string;
  cp?: string;
  pais?: string;
  // Documento
  tipoDoc: string;
  numDoc: string;
  vat?: string;
  docFile?: File | null;
  docUploaded?: boolean;
}

export type PartialGuestData = Partial<GuestData>;

// ─── Datos globales del checkin ───────────────────────────────────────────────
export interface CheckinState {
  appMode: AppMode;
  reserva: Reserva | null;
  /** Si el email está en la BD, datos precargados */
  knownGuest: GuestData | null;
  /** Número total de personas (principal + acompañantes) */
  numPersonas: number;
  /** Array de datos por persona. Índice 0 = huésped principal */
  guests: PartialGuestData[];
  /** Preferencias / extras (solo una vez, no por persona) */
  horaLlegada: string;
  observaciones: string;
}

// ─── Errores de validación ────────────────────────────────────────────────────
export type FormErrors = Record<string, string>;

// ─── Dirección de navegación ──────────────────────────────────────────────────
export type NavDirection = 'forward' | 'back';