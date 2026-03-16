import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AppMode,
  StepId,
  CheckinState,
  Reserva,
  GuestData,
  PartialGuestData,
  NavDirection,
  CheckinNav,     // ← viene de types/, NO se redefine aquí
  CheckinActions, // ← viene de types/, NO se redefine aquí
} from '../types';
import { DOT_STEPS_BASE } from '../constants';

// ─── Tipo interno del hook — NO se exporta ────────────────────────────────────
type HistoryEntry = { step: StepId; guestIndex: number };

const EMPTY_GUEST: PartialGuestData = {};

// ─── Serialización: excluir File antes de guardar en sessionStorage ───────────
function sanitizeGuests(guests: PartialGuestData[]): PartialGuestData[] {
  return guests.map(({ docFile: _f, ...rest }) => rest);
}

// ─── Hidratación desde sessionStorage ────────────────────────────────────────
function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva:      null,
    knownGuest:   null,
    numPersonas:  1,
    guests:       [{ ...EMPTY_GUEST }],
    horaLlegada:  '',
    observaciones: '',
    rgpdAcepted:  false,
  };
}

function hydrateState(token: string, appMode: AppMode): CheckinState {
  try {
    const raw = sessionStorage.getItem(`state_${token}`);
    if (raw) return JSON.parse(raw) as CheckinState;
  } catch { /* storage corrupto — arrancar limpio */ }
  return buildEmptyState(appMode);
}

function hydrateHistory(token: string): HistoryEntry[] {
  try {
    const raw = sessionStorage.getItem(`history_${token}`);
    if (raw) return JSON.parse(raw) as HistoryEntry[];
  } catch { /* ignore */ }
  return [];
}

function hydrateAllowedSteps(token: string): Set<StepId> {
  try {
    const raw = sessionStorage.getItem(`allowedSteps_${token}`);
    if (raw) return new Set(JSON.parse(raw) as StepId[]);
  } catch { /* ignore */ }
  return new Set<StepId>(['bienvenida', 'tablet_buscar']);
}

// Limpia sesiones antiguas para no acumular basura en sessionStorage
function pruneOldSessions(currentToken: string) {
  const PREFIX   = 'state_';
  const MAX_KEYS = 10;
  const old = Object.keys(sessionStorage)
    .filter(k => k.startsWith(PREFIX) && k !== `${PREFIX}${currentToken}`);
  if (old.length > MAX_KEYS) {
    old.slice(0, old.length - MAX_KEYS).forEach(k => {
      const t = k.replace(PREFIX, '');
      sessionStorage.removeItem(`state_${t}`);
      sessionStorage.removeItem(`history_${t}`);
      sessionStorage.removeItem(`allowedSteps_${t}`);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK PRINCIPAL
// Devuelve [state, nav, actions, isLoading]
// ─────────────────────────────────────────────────────────────────────────────
export function useCheckin(
  token:   string  = 'new',
  urlStep: string | undefined = undefined,
): [CheckinState, CheckinNav, CheckinActions, boolean] {
  const navigate = useNavigate();
  const appMode: AppMode = token === 'new' ? 'link' : 'tablet';
  const step = (urlStep as StepId | undefined) ?? 'bienvenida';

  const [isLoading, setIsLoading] = useState(token !== 'new');
  const [state,       setState]       = useState<CheckinState>(() => hydrateState(token, appMode));
  const [guestIndex,  setGuestIndex]  = useState(0);
  const [direction,   setDirection]   = useState<NavDirection>('forward');
  const [history,     setHistory]     = useState<HistoryEntry[]>(() => hydrateHistory(token));
  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => hydrateAllowedSteps(token));

  // Ref síncrono para el route guard — evita el frame visible del paso incorrecto
  const allowedStepsRef = useRef(allowedSteps);
  useEffect(() => { allowedStepsRef.current = allowedSteps; }, [allowedSteps]);

  // ── Fetch datos del token (solo si hay token real) ────────────────────────
  useEffect(() => {
    if (token === 'new') { setIsLoading(false); return; }
    if (state.knownGuest || state.reserva) { setIsLoading(false); return; }

    setIsLoading(true);
    fetch(`/api/checkin/${token}`)
      .then(r => r.json())
      .then((res: { status: string; data: GuestData | null }) => {
        if (res.status === 'found' && res.data) {
          setState(s => ({
            ...s,
            knownGuest: res.data,
            guests:     [{ ...(res.data as GuestData) }],
          }));
        }
      })
      .catch(err => console.error('Error fetch checkin:', err))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Persistencia en sessionStorage (solo session, no localStorage) ────────
  useEffect(() => {
    pruneOldSessions(token);
    const serialized = JSON.stringify({ ...state, guests: sanitizeGuests(state.guests) });
    sessionStorage.setItem(`state_${token}`,        serialized);
    sessionStorage.setItem(`allowedSteps_${token}`, JSON.stringify([...allowedSteps]));
    sessionStorage.setItem(`history_${token}`,      JSON.stringify(history));
  }, [state, allowedSteps, history, token]);

  // ── Route guard: redirige si el step no está permitido ───────────────────
  // Usa ref síncrono para no necesitar allowedSteps en las deps (evita bucle)
  useEffect(() => {
    if (isLoading) return;
    const isEntry = step === 'bienvenida' || step === 'tablet_buscar';
    if (isEntry) {
      if (!allowedStepsRef.current.has(step)) {
        setAllowedSteps(prev => new Set(prev).add(step));
      }
      return;
    }
    if (!allowedStepsRef.current.has(step)) {
      const lastSafe = history.length > 0 ? history[history.length - 1].step : 'bienvenida';
      navigate(`/checkin/${token}/${lastSafe}`, { replace: true });
    }
  }, [step, isLoading, navigate, token, history]);

  // ── Dots ─────────────────────────────────────────────────────────────────
  const dotSteps = DOT_STEPS_BASE;

  const dotForStep = (s: StepId): StepId =>
    (s === 'escanear' || s === 'confirmar_datos') ? 'form_personal' : s;

  const rawDotIndex = dotSteps.indexOf(dotForStep(step));
  const dotIndex    = rawDotIndex >= 0 ? rawDotIndex : 0;

  const canGoBack =
    step !== 'bienvenida' &&
    step !== 'exito' &&
    step !== 'tablet_buscar' &&
    history.length > 0;

  // ── Navegación ────────────────────────────────────────────────────────────
  const goTo = useCallback((
    nextStep: StepId,
    dir: NavDirection = 'forward',
    gIdx?: number,
  ) => {
    setHistory(h  => [...h, { step, guestIndex }]);
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

  const goToDotIndex = useCallback((targetIdx: number) => {
    if (targetIdx > dotIndex) return;
    const targetStep = dotSteps[targetIdx];
    setAllowedSteps(prev => new Set(prev).add(targetStep));
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection('back');
    setGuestIndex(0);
    navigate(`/checkin/${token}/${targetStep}`);
  }, [dotIndex, dotSteps, step, guestIndex, navigate, token]);

  // ── Tablet: reserva encontrada ────────────────────────────────────────────
  const setReservaFromTablet = useCallback((res: Reserva) => {
    const fresh = new Set<StepId>(['bienvenida', 'tablet_buscar']);
    allowedStepsRef.current = fresh;
    setAllowedSteps(fresh);
    setState(s => ({
      ...s,
      reserva:     res,
      numPersonas: res.numHuespedes,
      guests:      Array.from({ length: res.numHuespedes }, () => ({ ...EMPTY_GUEST })),
    }));
    setHistory([]);
    setDirection('forward');
    navigate(`/checkin/${token}/bienvenida`);
  }, [navigate, token]);

  // ── Personas ──────────────────────────────────────────────────────────────
  const setNumPersonas = useCallback((n: number) => {
    setState(s => {
      const cur     = s.guests;
      const updated = n > cur.length
        ? [...cur, ...Array.from({ length: n - cur.length }, () => ({ ...EMPTY_GUEST }))]
        : cur.slice(0, n);
      return { ...s, numPersonas: n, guests: updated };
    });
  }, []);

  // ── Datos por huésped ─────────────────────────────────────────────────────
  const updateGuest = useCallback((
    index: number,
    key: keyof PartialGuestData,
    value: unknown,
  ) => {
    setState(s => {
      const guests   = [...s.guests];
      guests[index]  = { ...guests[index], [key]: value };
      return { ...s, guests };
    });
  }, []);

  // confirmKnownGuest solo prepara el estado; App.tsx navega por separado
  const confirmKnownGuest = useCallback(() => { /* no-op intencional */ }, []);

  const applyScannedData = useCallback((data: Partial<GuestData>, guestIdx = 0) => {
    setState(s => {
      const guests  = [...s.guests];
      guests[guestIdx] = { ...guests[guestIdx], ...data };
      return { ...s, guests };
    });
  }, []);

  // ── Extras ────────────────────────────────────────────────────────────────
  const setHoraLlegada   = useCallback((v: string) => setState(s => ({ ...s, horaLlegada: v })),   []);
  const setObservaciones = useCallback((v: string) => setState(s => ({ ...s, observaciones: v })), []);
  const setRgpdAcepted   = useCallback((v: boolean) => setState(s => ({ ...s, rgpdAcepted: v })),  []);

  // ── Flujo multi-huésped ───────────────────────────────────────────────────
  // Principal:    form_personal → form_contacto → form_documento
  // Acompañantes: form_personal → form_documento (sin contacto)
  const nextGuest = useCallback((currentIdx: number, fromStep: StepId) => {
    const total = state.numPersonas;
    if (fromStep === 'form_personal') {
      currentIdx === 0
        ? goTo('form_contacto', 'forward', 0)
        : goTo('form_documento', 'forward', currentIdx);
    } else if (fromStep === 'form_contacto') {
      goTo('form_documento', 'forward', 0);
    } else if (fromStep === 'form_documento') {
      currentIdx < total - 1
        ? goTo('form_personal', 'forward', currentIdx + 1)
        : goTo('form_extras',   'forward', 0);
    }
  }, [state.numPersonas, goTo]);

  // ─────────────────────────────────────────────────────────────────────────
  const nav: CheckinNav = {
    step, guestIndex, direction, dotSteps, dotIndex, canGoBack,
  };

  const actions: CheckinActions = {
    goTo, goBack, goToDotIndex,
    setReservaFromTablet,
    setNumPersonas, updateGuest, confirmKnownGuest, applyScannedData,
    setHoraLlegada, setObservaciones,
    nextGuest, setRgpdAcepted,
  };

  return [state, nav, actions, isLoading];
}