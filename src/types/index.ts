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
  // docFile nunca se serializa en sessionStorage — solo docUploaded persiste
  docFile?: File | null;
  docUploaded?: boolean;
}

export type PartialGuestData = Partial<GuestData>;

// ─── Estado global del checkin ────────────────────────────────────────────────
export interface CheckinState {
  appMode: AppMode;
  reserva: Reserva | null;
  knownGuest: GuestData | null;
  numPersonas: number;
  guests: PartialGuestData[];
  horaLlegada: string;
  observaciones: string;
  rgpdAcepted: boolean;
}

// ─── Validación ───────────────────────────────────────────────────────────────
export type FormErrors = Record<string, string>;

// ─── Navegación ───────────────────────────────────────────────────────────────
export type NavDirection = 'forward' | 'back';

// ─── Contrato público del hook useCheckin ─────────────────────────────────────
// Estos tipos viven AQUÍ, no en el hook.
// Si un tipo lo necesita un consumidor externo (AppShell, App, screens),
// pertenece a types/. Los tipos internos del hook (HistoryEntry, etc.)
// se quedan en el hook sin export.
//
// Ventaja: puedes refactorizar useCheckin por completo sin romper ningún
// import externo, porque el contrato está desacoplado de la implementación.

export interface CheckinNav {
  step: StepId;
  guestIndex: number;
  direction: NavDirection;
  dotSteps: StepId[];
  dotIndex: number;
  canGoBack: boolean;
}

export interface CheckinActions {
  goTo: (step: StepId, dir?: NavDirection, gIdx?: number) => void;
  goBack: () => void;
  goToDotIndex: (dotIdx: number) => void;
  setReservaFromTablet: (res: Reserva) => void;
  setNumPersonas: (n: number) => void;
  updateGuest: (index: number, key: keyof PartialGuestData, value: unknown) => void;
  confirmKnownGuest: () => void;
  applyScannedData: (data: Partial<GuestData>, guestIdx?: number) => void;
  setHoraLlegada: (v: string) => void;
  setObservaciones: (v: string) => void;
  nextGuest: (currentGuestIndex: number, fromStep: StepId) => void;
  setRgpdAcepted: (v: boolean) => void;
}