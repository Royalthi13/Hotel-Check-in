// Tipos públicos — todos viven en types/, desacoplados de su implementación
export type {
  AppMode,
  StepId,
  Reserva,
  GuestData,
  PartialGuestData,
  CheckinState,
  FormErrors,
  NavDirection,
  CheckinNav,
  CheckinActions,
} from "./types";

// Hook — solo la función, no sus tipos internos (HistoryEntry, etc.)
export { useCheckin } from "./hooks/useCheckin";

// Validación — solo las funciones públicas
export {
  useFormValidation,
  validatePersonal,
  validateContacto,
  validateDocumento,
  validateNumPersonas,
} from "./hooks/useFormValidation";

// Constantes públicas
export {
  PAISES,
  NACIONALIDADES,
  TIPOS_DOCUMENTO,
  HORAS_LLEGADA,
  SEXOS,
  RELACIONES_MENOR,
  DOT_STEPS_BASE,
  DOT_LABELS,
  FLOW_STEPS_LINK,
  MOCK_KNOWN_GUEST,
} from "./constants";
// MOCK_RESERVAS no se exporta aquí — es un mock de desarrollo.
// Importar desde './mocks/reservas-mock' si se necesita directamente.

// Componentes UI
export * from "./components/ui";

// Layout
export { AppShell } from "./layout/AppShell";

// Screens
export { ScreenTabletBuscar } from "./screens/ScreenTabletBuscar";
export { ScreenBienvenida } from "./screens/ScreenBienvenida";
export { ScreenNumPersonas } from "./screens/ScreenNumPersonas";
export { ScreenEscanear } from "./screens/ScreenEscanear";
export { ScreenConfirmarDatos } from "./screens/ScreenConfirmardatos";
export {
  ScreenFormPersonal,
  ScreenFormContacto,
  ScreenFormDocumento,
} from "./screens/ScreenForms";
export {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from "./screens/ScreenExtrasRevisionExito";
