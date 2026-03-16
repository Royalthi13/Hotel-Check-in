import { useReducer, useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AppMode,
  StepId,
  CheckinState,
  Reserva,
  GuestData,
  PartialGuestData,
  NavDirection,
  CheckinNav,
  CheckinActions,
} from '@/types';
import { DOT_STEPS_BASE } from '@/constants';
import { checkinReducer, buildEmptyState } from './checkinReducer';

// ─── Tipo interno — NO se exporta ────────────────────────────────────────────
type HistoryEntry = { step: StepId; guestIndex: number };

function sanitizeGuests(guests: PartialGuestData[]): PartialGuestData[] {
  return guests.map(({ docFile: _f, ...rest }) => rest);
}

function hydrateState(token: string, appMode: AppMode): CheckinState {
  try {
    const raw = sessionStorage.getItem(`state_${token}`);
    if (raw) return JSON.parse(raw) as CheckinState;
  } catch { /* storage corrupto */ }
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

function pruneOldSessions(currentToken: string) {
  const PREFIX = 'state_';
  const MAX    = 10;
  const old    = Object.keys(sessionStorage)
    .filter(k => k.startsWith(PREFIX) && k !== `${PREFIX}${currentToken}`);
  if (old.length > MAX) {
    old.slice(0, old.length - MAX).forEach(k => {
      const t = k.replace(PREFIX, '');
      ['state_', 'history_', 'allowedSteps_'].forEach(p =>
        sessionStorage.removeItem(`${p}${t}`)
      );
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
export function useCheckin(
  token:   string             = 'new',
  urlStep: string | undefined = undefined,
): [CheckinState, CheckinNav, CheckinActions, boolean] {
  const navigate = useNavigate();
  const appMode: AppMode = token === 'new' ? 'link' : 'tablet';
  const step = (urlStep as StepId | undefined) ?? 'bienvenida';

  // ── useReducer: estado del formulario — cambios atómicos ──────────────────
  const [state, dispatch] = useReducer(
    checkinReducer,
    undefined,
    () => hydrateState(token, appMode),
  );

  // ── useState: estado de navegación (provocan re-renders en screens) ───────
  const [guestIndex,   setGuestIndex]   = useState(0);
  const [direction,    setDirection]    = useState<NavDirection>('forward');
  const [isLoading,    setIsLoading]    = useState(token !== 'new');
  const [history,      setHistory]      = useState<HistoryEntry[]>(() => hydrateHistory(token));
  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => hydrateAllowedSteps(token));

  const allowedStepsRef = useRef(allowedSteps);
  useEffect(() => { allowedStepsRef.current = allowedSteps; }, [allowedSteps]);

  // ── Fetch token ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (token === 'new') { setIsLoading(false); return; }
    if (state.knownGuest || state.reserva) { setIsLoading(false); return; }
    setIsLoading(true);
    fetch(`/api/checkin/${token}`)
      .then(r => r.json())
      .then((res: { status: string; data: GuestData | null }) => {
        if (res.status === 'found' && res.data) {
          dispatch({ type: 'SET_KNOWN_GUEST', guest: res.data });
        }
      })
      .catch(err => console.error('Error fetch checkin:', err))
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Persistencia sessionStorage ───────────────────────────────────────────
  useEffect(() => {
    pruneOldSessions(token);
    const s = JSON.stringify({ ...state, guests: sanitizeGuests(state.guests) });
    sessionStorage.setItem(`state_${token}`,        s);
    sessionStorage.setItem(`allowedSteps_${token}`, JSON.stringify([...allowedSteps]));
    sessionStorage.setItem(`history_${token}`,      JSON.stringify(history));
  }, [state, allowedSteps, history, token]);

  // ── Route guard ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const isEntry = step === 'bienvenida' || step === 'tablet_buscar';
    if (isEntry) {
      if (!allowedStepsRef.current.has(step))
        setAllowedSteps(prev => new Set(prev).add(step));
      return;
    }
    if (!allowedStepsRef.current.has(step)) {
      const last = history.length > 0 ? history[history.length - 1].step : 'bienvenida';
      navigate(`/checkin/${token}/${last}`, { replace: true });
    }
  }, [step, isLoading, navigate, token, history]);

  // ── Dots ──────────────────────────────────────────────────────────────────
  const dotSteps    = DOT_STEPS_BASE;
  const dotForStep  = (s: StepId): StepId =>
    (s === 'escanear' || s === 'confirmar_datos') ? 'form_personal' : s;
  const rawDot      = dotSteps.indexOf(dotForStep(step));
  const dotIndex    = rawDot >= 0 ? rawDot : 0;
  const canGoBack   =
    step !== 'bienvenida' && step !== 'exito' &&
    step !== 'tablet_buscar' && history.length > 0;

  // ── Navegación ────────────────────────────────────────────────────────────
  const goTo = useCallback((
    nextStep: StepId,
    dir: NavDirection = 'forward',
    gIdx?: number,
  ) => {
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

  const goToDotIndex = useCallback((idx: number) => {
    if (idx > dotIndex) return;
    const target = dotSteps[idx];
    setAllowedSteps(prev => new Set(prev).add(target));
    setHistory(h => [...h, { step, guestIndex }]);
    setDirection('back');
    setGuestIndex(0);
    navigate(`/checkin/${token}/${target}`);
  }, [dotIndex, dotSteps, step, guestIndex, navigate, token]);

  // ── Acciones del estado (despachan al reducer) ────────────────────────────

  // Tablet: 1 dispatch atómico en vez de 3 setState encadenados
  const setReservaFromTablet = useCallback((res: Reserva) => {
    const fresh = new Set<StepId>(['bienvenida', 'tablet_buscar']);
    allowedStepsRef.current = fresh;
    setAllowedSteps(fresh);
    dispatch({ type: 'SET_RESERVA_TABLET', reserva: res });
    setHistory([]);
    setDirection('forward');
    setGuestIndex(0);
    navigate(`/checkin/${token}/bienvenida`);
  }, [navigate, token]);

  const setNumPersonas = useCallback((n: number) =>
    dispatch({ type: 'SET_NUM_PERSONAS', n }), []);

  const updateGuest = useCallback((
    index: number,
    key: keyof PartialGuestData,
    value: unknown,
  ) => dispatch({ type: 'UPDATE_GUEST', index, key, value }), []);

  const confirmKnownGuest = useCallback(() => { /* no-op: App.tsx navega */ }, []);

  const applyScannedData = useCallback((data: Partial<GuestData>, guestIdx = 0) =>
    dispatch({ type: 'APPLY_SCAN', data, guestIdx }), []);

  const setHoraLlegada   = useCallback((value: string)  => dispatch({ type: 'SET_HORA_LLEGADA',  value }), []);
  const setObservaciones = useCallback((value: string)  => dispatch({ type: 'SET_OBSERVACIONES', value }), []);
  const setRgpdAcepted   = useCallback((value: boolean) => dispatch({ type: 'SET_RGPD',          value }), []);

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
  const nav: CheckinNav = { step, guestIndex, direction, dotSteps, dotIndex, canGoBack };

  const actions: CheckinActions = {
    goTo, goBack, goToDotIndex,
    setReservaFromTablet,
    setNumPersonas, updateGuest, confirmKnownGuest, applyScannedData,
    setHoraLlegada, setObservaciones, nextGuest, setRgpdAcepted,
  };

  return [state, nav, actions, isLoading];
}