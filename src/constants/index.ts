import type { GuestData, Reserva, StepId } from '../types';

// ─── Paleta de colores (CSS vars reference) ────────────────────────────────
export const COLORS = {
  primary:    '#fa865c',
  primaryD:   '#e5704a',
  primaryLt:  '#fef0ea',
  secondary:  '#324154',
  secMid:     '#4a5a6e',
  secLt:      '#6a7a8e',
  bg:         '#e5e2dd',
  bgDark:     '#23150f',
  white:      '#ffffff',
  border:     '#d0cbc4',
  borderLt:   '#e8e4de',
  text:       '#1e2c3a',
  textMid:    '#4a5a6a',
  textLow:    '#8a9aaa',
  ok:         '#2d7a50',
  okBg:       '#edf7f1',
  err:        '#c0392b',
  errBg:      '#fdf2f2',
} as const;

// ─── Mock: cliente conocido (viene por email con historial) ────────────────
export const MOCK_KNOWN_GUEST: GuestData = {
  nombre: 'Carlos', apellido: 'García', apellido2: 'López',
  sexo: 'Hombre', fechaNac: '1985-03-22', nacionalidad: 'Española',
  email: 'carlos.garcia@email.es', telefono: '+34 612 345 678',
  direccion: 'Calle Mayor, 42, 3.º A', ciudad: 'Madrid',
  provincia: 'Madrid', cp: '28001', pais: 'España',
  tipoDoc: 'DNI', numDoc: '12345678A', vat: '',
};

// ─── Mock: reservas para modo tablet ──────────────────────────────────────
export const MOCK_RESERVAS: Record<string, Reserva> = {
  '78432': {
    confirmacion: '#LM-78432',
    habitacion: 'Suite Junior Deluxe',
    fechaEntrada: '15 mar 2025',
    fechaSalida: '18 mar 2025',
    numHuespedes: 2,
    numNoches: 3,
  },
  '99999': {
    confirmacion: '#LM-99999',
    habitacion: 'Habitación Superior',
    fechaEntrada: '22 abr 2025',
    fechaSalida: '25 abr 2025',
    numHuespedes: 1,
    numNoches: 3,
  },
};

// ─── Opciones de selects ───────────────────────────────────────────────────
export const PAISES = [
  'España', 'Alemania', 'Francia', 'Italia', 'Portugal',
  'Reino Unido', 'EE. UU.', 'Argentina', 'México', 'Otro',
];

export const NACIONALIDADES = [
  'Española', 'Alemana', 'Francesa', 'Italiana', 'Portuguesa',
  'Inglesa', 'Estadounidense', 'Argentina', 'Mexicana', 'Otra',
];

export const TIPOS_DOCUMENTO = [
  'DNI', 'NIF', 'CIF', 'Pasaporte', 'NIE', 'Carnet de conducir', 'Otro',
];

export const HORAS_LLEGADA = [
  'No especificada', '12:00', '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
  'Después de medianoche',
];

export const SEXOS = ['Hombre', 'Mujer', 'No indicar'];

export const RELACIONES_MENOR = ['Hijo/a', 'Sobrino/a', 'Tutor legal', 'Otra'];

// ─── Definición de pasos con puntitos ─────────────────────────────────────
// Los pasos que aparecen como dots en la barra de progreso.
// "tablet_buscar" queda fuera del flujo con dots.
// El índice de guest (cuando hay varios) se añade dinámicamente en el hook.
export const FLOW_STEPS_LINK: StepId[] = [
  'bienvenida',
  'num_personas',
  'escanear',        // o form_personal; ambos comparten el mismo dot
  'form_personal',
  'form_contacto',
  'form_documento',
  'form_extras',
  'revision',
  'exito',
];

// Pasos que se muestran como dots (simplificado para la UI)
export const DOT_STEPS_BASE: StepId[] = [
  'bienvenida',
  'num_personas',
  'form_personal',   // "escanear" comparte este dot
  'form_contacto',
  'form_documento',
  'form_extras',
  'revision',
  'exito',
];

// Etiquetas para tooltip de dots
export const DOT_LABELS: Partial<Record<StepId, string>> = {
  bienvenida:    'Bienvenida',
  num_personas:  'Personas',
  form_personal: 'Datos personales',
  form_contacto: 'Contacto',
  form_documento:'Documento',
  form_extras:   'Preferencias',
  revision:      'Revisión',
  exito:         'Completado',
};