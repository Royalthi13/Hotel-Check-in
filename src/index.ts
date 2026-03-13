// ─── Barrel export de src/index.ts ───────────────────────────────────────────
//
// REGLA: solo exportar lo que un consumidor EXTERNO necesita conocer.
// NO hacer export * de módulos con implementación — eso filtra tipos internos.
//
// ✅ Bien: exportar el hook (la función) y los tipos públicos
// ❌ Mal: export * from './hooks/useCheckin' filtraba CheckinNav, CheckinActions
//         y cualquier cosa que el hook exporte en el futuro sin que te des cuenta

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
    CheckinNav,      // contrato público del hook, definido en types/
    CheckinActions,  // contrato público del hook, definido en types/
  } from './types';
  
  // Hook — solo la función, no sus tipos internos (HistoryEntry, etc.)
  export { useCheckin } from './hooks/useCheckin';
  
  // Validación — solo las funciones públicas, no el tipo ValidatorFn que es interno
  export {
    useFormValidation,
    validatePersonal,
    validateContacto,
    validateDocumento,
    validateNumPersonas,
  } from './hooks/useFormValidation';
  
  // Constantes públicas de la app
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
  } from './constants';
  // MOCK_RESERVAS deliberadamente NO exportado aquí — es un mock de desarrollo,
  // no una constante de producción. Importar desde './mocks/reservas-mock' si se necesita.
  
  // Componentes UI
  export * from './components/ui';
  
  // Layout
  export { AppShell } from './layout/AppShell';
  
  // Screens — exportadas individualmente para mayor control
  export { ScreenTabletBuscar }    from './screens/ScreenTabletBuscar';
  export { ScreenBienvenida }      from './screens/ScreenBienvenida';
  export { ScreenNumPersonas }     from './screens/ScreenNumPersonas';
  export { ScreenEscanear }        from './screens/ScreenEscanear';
  export { ScreenConfirmarDatos }  from './screens/ScreenConfirmarDatos';
  export {
    ScreenFormPersonal,
    ScreenFormContacto,
    ScreenFormDocumento,
  } from './screens/ScreenForms';
  export {
    ScreenFormExtras,
    ScreenRevision,
    ScreenExito,
  } from './screens/ScreenExtrasRevisionExito';