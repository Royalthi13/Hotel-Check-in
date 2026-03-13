import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AppMode, StepId, CheckinState, Reserva,
  GuestData, PartialGuestData, NavDirection,
} from '../types';
import { DOT_STEPS_BASE } from '../constants';

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

const EMPTY_GUEST: PartialGuestData = {};

// FIX 1: Excluir File objects al serializar — JSON.stringify silencia File como {}
function sanitizeGuestsForStorage(guests: PartialGuestData[]): PartialGuestData[] {
  return guests.map(g => {
    const { docFile, ...rest } = g as PartialGuestData & { docFile?: File };
    return rest;
  });
}

function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva: null,
    knownGuest: null,
    numPersonas: 1,
    guests: [EMPTY_GUEST],
    horaLlegada: '',
    observaciones: '',
    rgpdAcepted: false,
  };
}

type HistoryEntry = { step: StepId; guestIndex: number };

// FIX 22: Intentar recuperar de localStorage también (persiste entre sesiones)
function hydrateState(token: string, appMode: AppMode): CheckinState {
  try {
    const session = sessionStorage.getItem(`state_${token}`);
    if (session) return JSON.parse(session);
    const local = localStorage.getItem(`state_${token}`);
    if (local) return JSON.parse(local);
  } catch {
    // Storage corrupto — arrancar limpio
  }
  return buildEmptyState(appMode);
}

function hydrateHistory(token: string): HistoryEntry[] {
  try {
    const s = sessionStorage.getItem(`history_${token}`);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function hydrateAllowedSteps(token: string): Set<StepId> {
  try {
    const s = sessionStorage.getItem(`allowedSteps_${token}`);
    if (s) return new Set(JSON.parse(s));
  } catch {}
  return new Set(['bienvenida', 'tablet_buscar']);
}

// FIX 13: Limpiar claves de tokens antiguos en sessionStorage
function pruneOldSessions(currentToken: string) {
  const PREFIX = 'state_';
  const MAX_KEYS = 10;
  const tokenKeys = Object.keys(sessionStorage)
    .filter(k => k.startsWith(PREFIX) && k !== `${PREFIX}${currentToken}`);
  if (tokenKeys.length > MAX_KEYS) {
    tokenKeys.slice(0, tokenKeys.length - MAX_KEYS).forEach(k => {
      const token = k.replace(PREFIX, '');
      sessionStorage.removeItem(`state_${token}`);
      sessionStorage.removeItem(`history_${token}`);
      sessionStorage.removeItem(`allowedSteps_${token}`);
    });
  }
}

export function useCheckin(token: string = 'new', urlStep?: string): [CheckinState, CheckinNav, CheckinActions, boolean] {
  const navigate = useNavigate();
  const appMode: AppMode = token === 'new' ? 'link' : 'tablet';
  const step = (urlStep as StepId) || 'bienvenida';

  // FIX 12: Para token 'new' no hay nada que cargar del servidor
  const [isLoading, setIsLoading] = useState(token !== 'new');

  const [state, setState] = useState<CheckinState>(() => hydrateState(token, appMode));
  const [guestIndex, setGuestIndex] = useState(0);
  const [direction, setDirection] = useState<NavDirection>('forward');
  const [history, setHistory] = useState<HistoryEntry[]>(() => hydrateHistory(token));
  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => hydrateAllowedSteps(token));

  // FIX 4: ref síncrono para el route guard — evita el frame visible del paso incorrecto
  const allowedStepsRef = useRef(allowedSteps);
  useEffect(() => { allowedStepsRef.current = allowedSteps; }, [allowedSteps]);

  // ── FETCH DATOS (solo si hay token real) ──────────────────────────────
  useEffect(() => {
    if (token === 'new') {
      setIsLoading(false);
      return;
    }
    if (state.knownGuest || state.reserva) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetch(`/api/checkin/${token}`)
      .then(res => res.json())
      .then(response => {
        if (response.status === 'found' && response.data) {
          setState(s => ({
            ...s,
            knownGuest: response.data,
            guests: [{ ...response.data }],
          }));
        }
      })
      .catch(err => console.error('Error fetch checkin:', err))
      .finally(() => setIsLoading(false));
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PERSISTENCIA ─────────────────────────────────────────────────────
  useEffect(() => {
    pruneOldSessions(token);
    const sanitized = {
      ...state,
      guests: sanitizeGuestsForStorage(state.guests), // FIX 1
    };
    const serialized = JSON.stringify(sanitized);
    sessionStorage.setItem(`state_${token}`, serialized);
    localStorage.setItem(`state_${token}`, serialized);           // FIX 22
    sessionStorage.setItem(`allowedSteps_${token}`, JSON.stringify([...allowedSteps]));
    sessionStorage.setItem(`history_${token}`, JSON.stringify(history));
  }, [state, allowedSteps, history, token]);

  // ── VIGILANTE DE URL ─────────────────────────────────────────────────
  // FIX 4: Usa ref síncrono, sin allowedSteps en dependencias → sin bucle
  useEffect(() => {
    if (isLoading) return;
    const isEntryStep = step === 'bienvenida' || step === 'tablet_buscar';
    if (isEntryStep) {
      if (!allowedStepsRef.current.has(step)) {
        setAllowedSteps(prev => new Set(prev).add(step));
      }
      return;
    }
    if (!allowedStepsRef.current.has(step)) {
      const hist = history;
      const lastSafe = hist.length > 0 ? hist[hist.length - 1].step : 'bienvenida';
      navigate(`/checkin/${token}/${lastSafe}`, { replace: true });
    }
  }, [step, isLoading, navigate, token, history]);

  // ── CÁLCULO DE DOTS ──────────────────────────────────────────────────
  const dotSteps = DOT_STEPS_BASE;
  const dotForStep = (s: StepId): StepId =>
    (s === 'escanear' || s === 'confirmar_datos') ? 'form_personal' : s;
  // FIX 10: Fallback a 0 si el step no está mapeado — nunca -1 silencioso
  const rawDotIndex = dotSteps.indexOf(dotForStep(step));
  const dotIndex = rawDotIndex >= 0 ? rawDotIndex : 0;
  const canGoBack = step !== 'bienvenida' && step !== 'exito' && step !== 'tablet_buscar' && history.length > 0;

  // ── ACCIONES ─────────────────────────────────────────────────────────
  const goTo = useCallback((nextStep: StepId, dir: NavDirection = 'forward', gIdx?: number) => {
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection(dir);
    if (gIdx !== undefined) setGuestIndex(gIdx);
    setAllowedSteps(prev => new Set(prev).add(nextStep));
    navigate(`/checkin/${token}/${nextStep}`);
  }, [step, guestIndex, token, navigate]);

  const goBack = useCallback(() => {
    setHistory(h => {
      if (!h.length) { navigate(-1); return h; }
      const prev = h[h.length - 1];
      setDirection('back');
      setGuestIndex(prev.guestIndex);
      navigate(`/checkin/${token}/${prev.step}`);
      return h.slice(0, -1);
    });
  }, [navigate, token]);

  const goToDotIndex = useCallback((targetDotIdx: number) => {
    if (targetDotIdx > dotIndex) return;
    const targetStep = dotSteps[targetDotIdx];
    setAllowedSteps(prev => new Set(prev).add(targetStep));
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection('back');
    setGuestIndex(0);
    navigate(`/checkin/${token}/${targetStep}`);
  }, [dotIndex, dotSteps, step, guestIndex, navigate, token]);

  // FIX 5: Usar ref para evitar redirección redundante del vigilante
  const setReservaFromTablet = useCallback((res: Reserva) => {
    const freshAllowed = new Set<StepId>(['bienvenida', 'tablet_buscar', 'bienvenida']);
    allowedStepsRef.current = freshAllowed;
    setAllowedSteps(freshAllowed);
    setState(s => ({
      ...s,
      reserva: res,
      numPersonas: res.numHuespedes,
      guests: Array(res.numHuespedes).fill(null).map(() => ({ ...EMPTY_GUEST })),
    }));
    setHistory([]);
    setDirection('forward');
    navigate(`/checkin/${token}/bienvenida`);
  }, [navigate, token]);

  const setNumPersonas = useCallback((n: number) => {
    setState(s => {
      const current = s.guests;
      const updated: PartialGuestData[] = n > current.length
        ? [...current, ...Array(n - current.length).fill(null).map(() => ({ ...EMPTY_GUEST }))]
        : current.slice(0, n);
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

  // FIX 6: confirmKnownGuest ya NO navega — la navegación la controla App.tsx
  const confirmKnownGuest = useCallback(() => {
    // Solo prepara el estado; App.tsx llama goTo('form_contacto') por separado
  }, []);

  // FIX 11: applyScannedData acepta guestIdx para escanear por huésped, no global
  const applyScannedData = useCallback((data: Partial<GuestData>, guestIdx: number = 0) => {
    setState(s => {
      const guests = [...s.guests];
      guests[guestIdx] = { ...guests[guestIdx], ...data };
      return { ...s, guests };
    });
  }, []);

  const setHoraLlegada = useCallback((v: string) => setState(s => ({ ...s, horaLlegada: v })), []);
  const setObservaciones = useCallback((v: string) => setState(s => ({ ...s, observaciones: v })), []);

  // FIX 14: Persistir aceptación RGPD en estado global
  const setRgpdAcepted = useCallback((v: boolean) => setState(s => ({ ...s, rgpdAcepted: v })), []);

  // FIX 7: nextGuest corregido — acompañantes van form_personal → form_documento (sin contacto)
  const nextGuest = useCallback((currentIdx: number, fromStep: StepId) => {
    const total = state.numPersonas;
    if (fromStep === 'form_personal') {
      if (currentIdx === 0) {
        // Huésped principal siempre va a contacto primero
        goTo('form_contacto', 'forward', 0);
      } else {
        // Acompañantes: personal → documento directamente
        goTo('form_documento', 'forward', currentIdx);
      }
    } else if (fromStep === 'form_contacto') {
      // Solo huésped principal llega aquí
      goTo('form_documento', 'forward', 0);
    } else if (fromStep === 'form_documento') {
      if (currentIdx < total - 1) {
        // Siguiente acompañante
        goTo('form_personal', 'forward', currentIdx + 1);
      } else {
        // Último huésped → extras
        goTo('form_extras', 'forward', 0);
      }
    }
  }, [state.numPersonas, goTo]);

  const nav: CheckinNav = { step, guestIndex, direction, dotSteps, dotIndex, canGoBack };
  const actions: CheckinActions = {
    goTo, goBack, goToDotIndex, setReservaFromTablet, setNumPersonas,
    updateGuest, confirmKnownGuest, applyScannedData, setHoraLlegada,
    setObservaciones, nextGuest, setRgpdAcepted,
  };

  return [state, nav, actions, isLoading];
}