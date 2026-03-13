import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AppMode, StepId, CheckinState, Reserva,
  GuestData, PartialGuestData, NavDirection,
} from '../types';
import { MOCK_KNOWN_GUEST, DOT_STEPS_BASE } from '../constants';

// ─── Navegación: qué paso viene antes/después ─────────────────────────────
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
  applyScannedData: (data: Partial<GuestData>) => void;
  setHoraLlegada: (v: string) => void;
  setObservaciones: (v: string) => void;
  nextGuest: (currentGuestIndex: number, fromStep: StepId) => void;
}

const EMPTY_GUEST: PartialGuestData = {};

function buildInitialState(appMode: AppMode): CheckinState {
  const isLink = appMode === 'link';
  return {
    appMode,
    reserva: null,
    // 🛡️ DEFENSA: En producción, knownGuest vendrá del fetch inicial (MSW)
    knownGuest: isLink ? MOCK_KNOWN_GUEST : null, 
    numPersonas: 1,
    guests: [isLink ? { ...MOCK_KNOWN_GUEST } : EMPTY_GUEST],
    horaLlegada: '',
    observaciones: '',
  };
}

type HistoryEntry = { step: StepId; guestIndex: number };

export function useCheckin(token: string = 'new', urlStep?: string): [CheckinState, CheckinNav, CheckinActions] {
  const navigate = useNavigate();
  
  const appMode: AppMode = token === 'new' ? 'link' : 'tablet';
  const step = (urlStep as StepId) || 'bienvenida';

  const [state, setState] = useState<CheckinState>(() => buildInitialState(appMode));
  const [guestIndex, setGuestIndex] = useState(0);
  const [direction, setDirection] = useState<NavDirection>('forward');
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // NUEVA ESTRATEGIA DE SEGURIDAD: Un Set con los pasos que el usuario tiene derecho a visitar
  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(new Set(['bienvenida', 'tablet_buscar']));

  const dotSteps = DOT_STEPS_BASE;

  const dotForStep = (s: StepId): StepId => {
    if (s === 'escanear' || s === 'confirmar_datos') return 'form_personal';
    return s;
  };

  const dotIndex = dotSteps.indexOf(dotForStep(step));

  const canGoBack =
    step !== 'bienvenida' &&
    step !== 'exito' &&
    step !== 'tablet_buscar' &&
    history.length > 0;

  // ── VIGILANTE DE LA URL (Route Guard Robusto) ─────────────────────────────
  useEffect(() => {
    // Si la URL pide un paso que NO está en nuestra lista de permitidos...
    if (!allowedSteps.has(step)) {
      console.warn(`Intento de salto ilegal al paso: ${step}`);
      // Volvemos al último paso seguro que tengamos en el historial, o a bienvenida
      const lastSafeStep = history.length > 0 ? history[history.length - 1].step : 'bienvenida';
      navigate(`/checkin/${token}/${lastSafeStep}`, { replace: true });
    }
  }, [step, allowedSteps, history, navigate, token]);

  // ── Navegar a un paso concreto ────────────────────────────────────────────
  const goTo = useCallback((nextStep: StepId, dir: NavDirection = 'forward', gIdx?: number) => {
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection(dir);
    if (gIdx !== undefined) setGuestIndex(gIdx);
    
    // NUEVO: Registramos el siguiente paso como "legal" antes de navegar
    setAllowedSteps(prev => new Set(prev).add(nextStep));
    
    navigate(`/checkin/${token}/${nextStep}`);
  }, [step, guestIndex, token, navigate]);

  // ── Volver atrás (pila de historial) ─────────────────────────────────────
  const goBack = useCallback(() => {
    setHistory(h => {
      if (!h.length) {
        navigate(-1);
        return h;
      }
      const prev = h[h.length - 1];
      setDirection('back');
      setGuestIndex(prev.guestIndex);
      navigate(`/checkin/${token}/${prev.step}`);
      return h.slice(0, -1);
    });
  }, [navigate, token]);

  // ── Navegar clickando un dot ───────────────────────────────────────────────
  const goToDotIndex = useCallback((targetDotIdx: number) => {
    if (targetDotIdx > dotIndex) return; 
    const targetStep = dotSteps[targetDotIdx];
    
    // Como volvemos a un paso anterior por el dot, debemos garantizar que sea legal
    setAllowedSteps(prev => new Set(prev).add(targetStep));
    
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection('back');
    setGuestIndex(0);
    navigate(`/checkin/${token}/${targetStep}`);
  }, [dotIndex, dotSteps, step, guestIndex, navigate, token]);

  // ... (El resto de funciones se mantienen exactamente igual)
  const setReservaFromTablet = useCallback((res: Reserva) => {
    setState(s => ({ ...s, reserva: res }));
    setHistory([]);
    setDirection('forward');
    setAllowedSteps(new Set(['bienvenida'])); // Reseteamos permisos
    navigate(`/checkin/${token}/bienvenida`);
  }, [navigate, token]);

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

  const updateGuest = useCallback((index: number, key: keyof PartialGuestData, value: unknown) => {
    setState(s => {
      const guests = [...s.guests];
      guests[index] = { ...guests[index], [key]: value };
      return { ...s, guests };
    });
  }, []);

  const confirmKnownGuest = useCallback(() => {
    goTo('form_contacto');
  }, [goTo]);

  const applyScannedData = useCallback((data: Partial<GuestData>) => {
    setState(s => {
      const guests = [...s.guests];
      guests[0] = { ...guests[0], ...data };
      return { ...s, guests };
    });
  }, []);

  const setHoraLlegada = useCallback((v: string) => setState(s => ({ ...s, horaLlegada: v })), []);
  const setObservaciones = useCallback((v: string) => setState(s => ({ ...s, observaciones: v })), []);

  const nextGuest = useCallback((currentIdx: number, fromStep: StepId) => {
    const total = state.numPersonas;
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