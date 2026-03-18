// ─── Modos de entrada ────────────────────────────────────────────────────────
export type AppMode = "link" | "tablet";

// ─── Pasos del flujo ──────────────────────────────────────────────────────────
export type StepId =
  | "tablet_buscar"
  | "bienvenida"
  | "num_personas"
  | "confirmar_datos"
  | "escanear"
  | "form_personal"
  | "form_contacto"
  | "form_documento"
  | "form_relaciones"
  | "form_extras"
  | "revision"
  | "exito";

// ─── Reserva ──────────────────────────────────────────────────────────────────
export interface Reserva {
  confirmacion: string;
  habitacion: string;
  fechaEntrada: string;
  fechaSalida: string;
  numHuespedes: number;
  numNoches: number;
}

// ─── Relación de un menor con un adulto del grupo ─────────────────────────────
export interface RelacionConAdulto {
  adultoIndex: number;
  parentesco: string;
}

// ─── Datos de un huésped ──────────────────────────────────────────────────────
export interface GuestData {
  nombre: string;
  apellido: string;
  apellido2: string;
  sexo: string;
  fechaNac: string;
  nacionalidad: string;

  esMenor: boolean;

  // --- NUEVOS CAMPOS PARA LA LÓGICA DE MENORES ---
  vengoConMenores?: boolean; // Para el checkbox del titular
  tienesMenor?: boolean; // Para saber si mostrar datos de menor en la revisión
  nombreMenor?: string; // Nombre del responsable (usado en validación)
  relacionMenor?: string; // Parentesco simple (usado en validación)
  relacionesConAdultos: RelacionConAdulto[]; // Matriz completa de parentescos

  // Contacto (Huésped principal)
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

// ─── Estado global del checkin ────────────────────────────────────────────────
export interface CheckinState {
  appMode: AppMode;
  reserva: Reserva | null;
  knownGuest: GuestData | null;

  numAdultos: number;
  numMenores: number;
  numPersonas: number; // 👈 ¡ESTO ES LO QUE TE FALTA!
  guests: PartialGuestData[];

  horaLlegada: string;
  observaciones: string;
  rgpdAcepted: boolean;
}

// ─── Validación, Navegación y Hook ───────────────────────────────────────────
export type FormErrors = Record<string, string>;
export type NavDirection = "forward" | "back";

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
  setNumPersonas: (adultos: number, menores: number) => void;
  updateGuest: (
    index: number,
    key: keyof PartialGuestData,
    value: unknown,
  ) => void;
  updateRelacion: (
    menorIndex: number,
    adultoIndex: number,
    parentesco: string,
  ) => void;
  confirmKnownGuest: () => void;
  applyScannedData: (data: Partial<GuestData>, guestIdx?: number) => void;
  setHoraLlegada: (v: string) => void;
  setObservaciones: (v: string) => void;
  nextGuest: (currentGuestIndex: number, fromStep: StepId) => void;
  setRgpdAcepted: (v: boolean) => void;
}
