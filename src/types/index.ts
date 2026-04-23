// ─── Modos de entrada ────────────────────────────────────────────────────────
export type AppMode = "link" | "tablet";

// ─── Pasos del flujo ──────────────────────────────────────────────────────────
export type StepId =
  | "tablet_buscar"
  | "inicio"
  | "bienvenida"
  | "confirmar_datos"
  | "escanear"
  | "form_personal"
  | "form_contacto"
  | "form_documento"
  | "form_relaciones"
  | "num_personas"
  | "form_extras"
  | "revision"
  | "exito";

// ─── Room Type ──────────────────────────────────────────────────────────────────

export type RoomTypeName =
  | "Individual"
  | "Doble"
  | "Triple"
  | "Matrimonio"
  | "Suite";

export interface RoomTypeResponse {
  id: number;
  name: RoomTypeName;
}

export interface RelacionDB {
  codrelation: string;
  name: string;
  linked_relation: string | null;
}
// ─── Reserva ──────────────────────────────────────────────────────────────────
export interface Reserva {
  confirmacion: string;
  habitacion: string;
  fechaEntrada: string;
  fechaSalida: string;
  numHuespedes: number;
  numNoches: number;
  client_id?: number;
}

// ─── Relación de un menor con un adulto del grupo ─────────────────────────────
export interface RelacionConAdulto {
  adultoIndex: number;
  parentesco: string;
}

// ─── Datos de un huésped ──────────────────────────────────────────────────────
export interface GuestData {
  id?: number;
  nombre: string;
  apellido: string;
  apellido2: string;
  sexo: string;
  fechaNac: string;
  nacionalidad: string;
  parentescoParaAPI?: string;
  esMenor: boolean;

  vengoConMenores?: boolean;
  tienesMenor?: boolean;
  nombreMenor?: string;
  relacionMenor?: string;
  relacionesConAdultos: RelacionConAdulto[];

  // Contacto (Huésped principal)
  email?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  codCity?: string;
  provincia?: string;
  cp?: string;
  pais?: string;

  // Documento
  tipoDoc: string;
  numDoc: string;
  soporteDoc?: string;
  vat?: string;
  prefijo?: string;
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
  numPersonas: number;
  guests: PartialGuestData[];
  horaLlegada: string;
  observaciones: string;
  rgpdAcepted: boolean;
  legalPassed: boolean;
  hasMinorsFlag: boolean;
  bookingId: number | null;
  clientId: number | null;
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
  allowedSteps: Set<StepId>;
  isNavigating: boolean;
  maxAllowedDotIndex: number;
}

export interface CheckinActions {
  goTo: (step: StepId, dir?: NavDirection, gIdx?: number) => void;
  goBack: () => void;
  goToDotIndex: (dotIdx: number) => void;
  setReservaFromTablet: (
    res: Reserva,
    bookingId: number,
    clientId: number | null,
  ) => void;
  setNumPersonas: (total: number) => void;
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
  setLegalPassed: (v: boolean) => void;
  setHasMinorsFlag: (v: boolean) => void;
  handleSubmit?: () => Promise<void>;
  setGuests: (guests: PartialGuestData[]) => void;
}
