// ─── Reducer del estado de check-in ──────────────────────────────────────────
//
// Por qué useReducer en vez de useState:
// Con múltiples setState encadenados (ej: setReservaFromTablet hace 3 updates)
// React puede renderizar estados intermedios inconsistentes.
// Un reducer aplica TODOS los cambios en una sola transacción atómica.
//
// Además, todas las transiciones de estado quedan documentadas aquí,
// lo que hace el código mucho más fácil de auditar y testear.

import type {
  CheckinState,
  AppMode,
  Reserva,
  GuestData,
  PartialGuestData,
} from '@/types';

// ─── Acciones ────────────────────────────────────────────────────────────────

export type CheckinAction =
  | { type: 'INIT';              appMode: AppMode }
  | { type: 'SET_KNOWN_GUEST';   guest: GuestData }
  | { type: 'SET_RESERVA_TABLET'; reserva: Reserva }
  | { type: 'SET_NUM_PERSONAS';  n: number }
  | { type: 'UPDATE_GUEST';      index: number; key: keyof PartialGuestData; value: unknown }
  | { type: 'APPLY_SCAN';        data: Partial<GuestData>; guestIdx: number }
  | { type: 'SET_HORA_LLEGADA';  value: string }
  | { type: 'SET_OBSERVACIONES'; value: string }
  | { type: 'SET_RGPD';          value: boolean }
  | { type: 'RESET' };

// ─── Estado vacío ─────────────────────────────────────────────────────────────

const EMPTY_GUEST: PartialGuestData = {};

export function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva:       null,
    knownGuest:    null,
    numPersonas:   1,
    guests:        [{ ...EMPTY_GUEST }],
    horaLlegada:   '',
    observaciones: '',
    rgpdAcepted:   false,
  };
}

function makeGuests(n: number): PartialGuestData[] {
  return Array.from({ length: n }, () => ({ ...EMPTY_GUEST }));
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export function checkinReducer(
  state: CheckinState,
  action: CheckinAction,
): CheckinState {
  switch (action.type) {

    // Carga inicial de datos del token (cliente conocido)
    case 'SET_KNOWN_GUEST':
      return {
        ...state,
        knownGuest: action.guest,
        guests:     [{ ...action.guest }],
      };

    // Tablet: reserva encontrada — resetea guests al número de huéspedes
    // Todos los cambios en UNA sola transacción atómica
    case 'SET_RESERVA_TABLET':
      return {
        ...state,
        reserva:     action.reserva,
        numPersonas: action.reserva.numHuespedes,
        guests:      makeGuests(action.reserva.numHuespedes),
        // Resetear datos del formulario anterior
        horaLlegada:   '',
        observaciones: '',
        rgpdAcepted:   false,
      };

    // Cambia el número de personas ajustando el array de guests
    case 'SET_NUM_PERSONAS': {
      const n   = action.n;
      const cur = state.guests;
      const updated: PartialGuestData[] = n > cur.length
        ? [...cur, ...makeGuests(n - cur.length)]
        : cur.slice(0, n);
      return { ...state, numPersonas: n, guests: updated };
    }

    // Actualiza un campo de un huésped concreto
    case 'UPDATE_GUEST': {
      const guests   = [...state.guests];
      guests[action.index] = { ...guests[action.index], [action.key]: action.value };
      return { ...state, guests };
    }

    // Precarga datos del escaneo OCR en un huésped concreto
    case 'APPLY_SCAN': {
      const guests = [...state.guests];
      guests[action.guestIdx] = { ...guests[action.guestIdx], ...action.data };
      return { ...state, guests };
    }

    case 'SET_HORA_LLEGADA':
      return { ...state, horaLlegada: action.value };

    case 'SET_OBSERVACIONES':
      return { ...state, observaciones: action.value };

    case 'SET_RGPD':
      return { ...state, rgpdAcepted: action.value };

    case 'RESET':
      return buildEmptyState(state.appMode);

    default:
      return state;
  }
}