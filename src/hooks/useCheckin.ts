import { useState, useCallback } from 'react';
import type {
  AppMode, StepId, CheckinState, Reserva,
  GuestData, PartialGuestData, NavDirection,
} from '../types';
import { MOCK_KNOWN_GUEST, MOCK_RESERVAS, DOT_STEPS_BASE } from '../constants';

// ─── Navegación: qué paso viene antes/después ─────────────────────────────
// El flujo de pasos de formulario depende de cuántos huéspedes hay.
// Cuando hay N personas, los pasos form_personal / form_documento se repiten
// una vez por persona. El hook maneja el índice de persona activo.

export interface CheckinNav {
  step: StepId;
  /** Índice del huésped que se está editando (0 = principal) */
  guestIndex: number;
  direction: NavDirection;
  /** Array de StepId que se usan como dots (sin duplicados por persona) */
  dotSteps: StepId[];
  /** Índice activo en dotSteps */
  dotIndex: number;
  canGoBack: boolean;
}

export interface CheckinActions {
  goTo: (step: StepId, dir?: NavDirection) => void;
  goBack: () => void;
  goToDotIndex: (dotIdx: number) => void;
  // Tablet
  setReservaFromTablet: (res: Reserva) => void;
  // Número de personas
  setNumPersonas: (n: number) => void;
  // Datos de un huésped concreto
  updateGuest: (index: number, key: keyof PartialGuestData, value: unknown) => void;
  // Confirmar datos del cliente conocido (no editar)
  confirmKnownGuest: () => void;
  // Escaneo OK → precargar datos en guest[0]
  applyScannedData: (data: Partial<GuestData>) => void;
  // Extras globales
  setHoraLlegada: (v: string) => void;
  setObservaciones: (v: string) => void;
  // Avanzar al siguiente huésped o al siguiente paso real
  nextGuest: (currentGuestIndex: number, fromStep: StepId) => void;
}

const EMPTY_GUEST: PartialGuestData = {};

function buildInitialState(appMode: AppMode): CheckinState {
  const isLink = appMode === 'link';
  return {
    appMode,
    reserva: null,
    knownGuest: isLink ? MOCK_KNOWN_GUEST : null, // en prod vendría del backend
    numPersonas: 1,
    guests: [isLink ? { ...MOCK_KNOWN_GUEST } : EMPTY_GUEST],
    horaLlegada: '',
    observaciones: '',
  };
}

// Historial de navegación para poder volver atrás con la pila correcta
type HistoryEntry = { step: StepId; guestIndex: number };

export function useCheckin(appMode: AppMode): [CheckinState, CheckinNav, CheckinActions] {
  const [state, setState] = useState<CheckinState>(() => buildInitialState(appMode));
  const [step, setStep] = useState<StepId>(appMode === 'tablet' ? 'tablet_buscar' : 'bienvenida');
  const [guestIndex, setGuestIndex] = useState(0);
  const [direction, setDirection] = useState<NavDirection>('forward');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // ── Dot steps siempre los mismos (no se multiplican por persona) ──────────
  const dotSteps = DOT_STEPS_BASE;

  const dotForStep = (s: StepId): StepId => {
    // "escanear" y "confirmar_datos" se mapean al dot de "form_personal"
    if (s === 'escanear' || s === 'confirmar_datos') return 'form_personal';
    return s;
  };

  const dotIndex = dotSteps.indexOf(dotForStep(step));

  const canGoBack =
    step !== 'bienvenida' &&
    step !== 'exito' &&
    step !== 'tablet_buscar' &&
    history.length > 0;

  // ── Navegar a un paso concreto ────────────────────────────────────────────
  const goTo = useCallback((nextStep: StepId, dir: NavDirection = 'forward', gIdx?: number) => {
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection(dir);
    if (gIdx !== undefined) setGuestIndex(gIdx);
    setStep(nextStep);
  }, [step, guestIndex]);

  // ── Volver atrás (pila de historial) ─────────────────────────────────────
  const goBack = useCallback(() => {
    setHistory(h => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setDirection('back');
      setStep(prev.step);
      setGuestIndex(prev.guestIndex);
      return h.slice(0, -1);
    });
  }, []);

  // ── Navegar clickando un dot ───────────────────────────────────────────────
  // Solo se puede ir a dots ya visitados (≤ dotIndex actual)
  const goToDotIndex = useCallback((targetDotIdx: number) => {
    if (targetDotIdx > dotIndex) return; // no saltar adelante
    const targetStep = dotSteps[targetDotIdx];
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection('back');
    setGuestIndex(0);
    setStep(targetStep);
  }, [dotIndex, dotSteps, step, guestIndex]);

  // ── Tablet: reserva encontrada ────────────────────────────────────────────
  const setReservaFromTablet = useCallback((res: Reserva) => {
    setState(s => ({ ...s, reserva: res }));
    setHistory([]);
    setDirection('forward');
    setStep('bienvenida');
  }, []);

  // ── Número de personas ────────────────────────────────────────────────────
  const setNumPersonas = useCallback((n: number) => {
    setState(s => {
      const current = s.guests;
      let updated: PartialGuestData[];
      if (n > current.length) {
        updated = [...current, ...Array(n - current.length).fill(EMPTY_GUEST).map(() => ({ ...EMPTY_GUEST }))];
      } else {
        updated = current.slice(0, n);
      }
      return { ...s, numPersonas: n, guests: updated };
    });
  }, []);

  // ── Actualizar campo de un huésped ────────────────────────────────────────
  const updateGuest = useCallback((index: number, key: keyof PartialGuestData, value: unknown) => {
    setState(s => {
      const guests = [...s.guests];
      guests[index] = { ...guests[index], [key]: value };
      return { ...s, guests };
    });
  }, []);

  // ── Confirmar datos del cliente conocido sin editar ───────────────────────
  const confirmKnownGuest = useCallback(() => {
    // Los datos ya están en guests[0] desde el init
    goTo('form_contacto');
  }, [goTo]);

  // ── Datos del escaneo → guest[0] ──────────────────────────────────────────
  const applyScannedData = useCallback((data: Partial<GuestData>) => {
    setState(s => {
      const guests = [...s.guests];
      guests[0] = { ...guests[0], ...data };
      return { ...s, guests };
    });
  }, []);

  // ── Extras ────────────────────────────────────────────────────────────────
  const setHoraLlegada = useCallback((v: string) => setState(s => ({ ...s, horaLlegada: v })), []);
  const setObservaciones = useCallback((v: string) => setState(s => ({ ...s, observaciones: v })), []);

  // ── Lógica de "siguiente huésped o siguiente paso" ────────────────────────
  // Cuando terminamos form_documento de un huésped:
  //   - Si hay más huéspedes → volver a form_personal con el siguiente índice
  //   - Si era el último → ir a form_extras
  const nextGuest = useCallback((currentIdx: number, fromStep: StepId) => {
    const total = state.numPersonas;
    // Desde form_documento, si quedan más personas
    if (fromStep === 'form_documento' && currentIdx < total - 1) {
      const nextIdx = currentIdx + 1;
      goTo('form_personal', 'forward', nextIdx);
    } else if (fromStep === 'form_documento') {
      goTo('form_extras', 'forward', 0);
    } else if (fromStep === 'form_personal') {
      goTo('form_contacto', 'forward', currentIdx);
    } else if (fromStep === 'form_contacto') {
      goTo('form_documento', 'forward', currentIdx);
    }
  }, [state.numPersonas, goTo]);

  const nav: CheckinNav = {
    step,
    guestIndex,
    direction,
    dotSteps,
    dotIndex,
    canGoBack,
  };

  const actions: CheckinActions = {
    goTo,
    goBack,
    goToDotIndex,
    setReservaFromTablet,
    setNumPersonas,
    updateGuest,
    confirmKnownGuest,
    applyScannedData,
    setHoraLlegada,
    setObservaciones,
    nextGuest,
  };

  return [state, nav, actions];
}