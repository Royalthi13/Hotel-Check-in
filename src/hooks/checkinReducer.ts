import type {
  CheckinState,
  AppMode,
  Reserva,
  GuestData,
  PartialGuestData,
} from '@/types';

// ─── Acciones ────────────────────────────────────────────────────────────────
export type CheckinAction =
  | { type: 'SET_KNOWN_GUEST';    guest: GuestData }
  | { type: 'SET_RESERVA_TABLET'; reserva: Reserva }
  | { type: 'SET_NUM_PERSONAS';   adultos: number; menores: number }
  | { type: 'UPDATE_GUEST';       index: number; key: keyof PartialGuestData; value: unknown }
  | { type: 'UPDATE_RELACION';    menorIndex: number; adultoIndex: number; parentesco: string }
  | { type: 'APPLY_SCAN';         data: Partial<GuestData>; guestIdx: number }
  | { type: 'SET_HORA_LLEGADA';   value: string }
  | { type: 'SET_OBSERVACIONES';  value: string }
  | { type: 'SET_RGPD';           value: boolean }
  | { type: 'RESET' };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const EMPTY_ADULT: PartialGuestData = { esMenor: false, relacionesConAdultos: [] };
const EMPTY_MINOR: PartialGuestData = { esMenor: true,  relacionesConAdultos: [] };

export function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva:       null,
    knownGuest:    null,
    numAdultos:    1,
    numMenores:    0,
    numPersonas:   1, // 👈 AÑADIDO
    guests:        [{ ...EMPTY_ADULT }],
    horaLlegada:   '',
    observaciones: '',
    rgpdAcepted:   false,
  };
}

function makeGuests(adultos: number, menores: number): PartialGuestData[] {
  return [
    ...Array.from({ length: adultos }, () => ({ ...EMPTY_ADULT })),
    ...Array.from({ length: menores }, () => ({
      ...EMPTY_MINOR,
      relacionesConAdultos: Array.from({ length: adultos }, (_, i) => ({
        adultoIndex: i,
        parentesco: '',
      })),
    })),
  ];
}

function mergeGuests(
  prev: PartialGuestData[],
  adultos: number,
  menores: number,
): PartialGuestData[] {
  return makeGuests(adultos, menores).map((empty, i) => {
    const existing = prev[i];
    if (!existing) return empty;
    if (empty.esMenor) {
      return {
        ...existing,
        esMenor: true,
        relacionesConAdultos: Array.from({ length: adultos }, (_, ai) => {
          const prevRel = (existing.relacionesConAdultos ?? []).find(r => r.adultoIndex === ai);
          return prevRel ?? { adultoIndex: ai, parentesco: '' };
        }),
      };
    }
    return { ...existing, esMenor: false };
  });
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
export function checkinReducer(
  state: CheckinState,
  action: CheckinAction,
): CheckinState {
  switch (action.type) {

    case 'SET_KNOWN_GUEST':
      return {
        ...state,
        knownGuest: action.guest,
        numPersonas: 1, // 👈 AÑADIDO
        guests: [{ ...action.guest, esMenor: false, relacionesConAdultos: [] }],
      };

    case 'SET_RESERVA_TABLET':
      return {
        ...state,
        reserva:       action.reserva,
        numAdultos:    action.reserva.numHuespedes,
        numMenores:    0,
        numPersonas:   action.reserva.numHuespedes, // 👈 AÑADIDO
        guests:        makeGuests(action.reserva.numHuespedes, 0),
        horaLlegada:   '',
        observaciones: '',
        rgpdAcepted:   false,
      };

    case 'SET_NUM_PERSONAS':
      return {
        ...state,
        numAdultos: action.adultos,
        numMenores: action.menores,
        numPersonas: action.adultos + action.menores, // 👈 SUMA AÑADIDA
        guests: mergeGuests(state.guests, action.adultos, action.menores),
      };

    case 'UPDATE_GUEST': {
      const guests = [...state.guests];
      guests[action.index] = { ...guests[action.index], [action.key]: action.value };
      return { ...state, guests };
    }

    case 'UPDATE_RELACION': {
      const realIndex = state.numAdultos + action.menorIndex;
      const guests = [...state.guests];
      const menor = { ...guests[realIndex] };
      menor.relacionesConAdultos = (menor.relacionesConAdultos ?? []).map(r =>
        r.adultoIndex === action.adultoIndex
          ? { ...r, parentesco: action.parentesco }
          : r
      );
      guests[realIndex] = menor;
      return { ...state, guests };
    }

    case 'APPLY_SCAN': {
      const guests = [...state.guests];
      guests[action.guestIdx] = { ...guests[action.guestIdx], ...action.data };
      return { ...state, guests };
    }

    case 'SET_HORA_LLEGADA':   return { ...state, horaLlegada:   action.value };
    case 'SET_OBSERVACIONES':  return { ...state, observaciones: action.value };
    case 'SET_RGPD':           return { ...state, rgpdAcepted:   action.value };
    case 'RESET':              return buildEmptyState(state.appMode);
    default:                   return state;
  }
}