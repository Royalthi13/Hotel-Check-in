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

  const [state, dispatch] = useReducer(
    checkinReducer,
    undefined,
    () => hydrateState(token, appMode),
  );

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
        if (res.status === 'found' && res.data)
          dispatch({ type: 'SET_KNOWN_GUEST', guest: res.data });
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
  const dotSteps = DOT_STEPS_BASE;
  const dotForStep = (s: StepId): StepId =>
    (s === 'escanear' || s === 'confirmar_datos' || s === 'form_relaciones')
      ? 'form_personal' : s;
  const rawDot   = dotSteps.indexOf(dotForStep(step));
  const dotIndex = rawDot >= 0 ? rawDot : 0;
  const canGoBack =
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

  // ── Acciones ──────────────────────────────────────────────────────────────
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

  // Recibe adultos y menores por separado
  const setNumPersonas = useCallback((adultos: number, menores: number) =>
    dispatch({ type: 'SET_NUM_PERSONAS', adultos, menores }), []);

  const updateGuest = useCallback((
    index: number,
    key: keyof PartialGuestData,
    value: unknown,
  ) => dispatch({ type: 'UPDATE_GUEST', index, key, value }), []);

  // Actualiza el parentesco de menor[menorIndex] con adulto[adultoIndex]
  const updateRelacion = useCallback((
    menorIndex: number,
    adultoIndex: number,
    parentesco: string,
  ) => dispatch({ type: 'UPDATE_RELACION', menorIndex, adultoIndex, parentesco }), []);

  const confirmKnownGuest = useCallback(() => { /* App.tsx navega */ }, []);

  const applyScannedData = useCallback((data: Partial<GuestData>, guestIdx = 0) =>
    dispatch({ type: 'APPLY_SCAN', data, guestIdx }), []);

  const setHoraLlegada   = useCallback((value: string)  => dispatch({ type: 'SET_HORA_LLEGADA',  value }), []);
  const setObservaciones = useCallback((value: string)  => dispatch({ type: 'SET_OBSERVACIONES', value }), []);
  const setRgpdAcepted   = useCallback((value: boolean) => dispatch({ type: 'SET_RGPD',          value }), []);

  // ── Flujo nextGuest ───────────────────────────────────────────────────────
  // Orden:
  //   Adultos: personal → (contacto solo el 0) → documento
  //   Menores: personal → documento → relaciones con cada adulto
  // Al terminar todos → form_extras
  const nextGuest = useCallback((currentIdx: number, fromStep: StepId) => {
    const { numAdultos, numMenores } = state;
    const totalAdultos = numAdultos;
    const totalMenores = numMenores;
    const hasMenores   = totalMenores > 0;

    if (fromStep === 'form_personal') {
      if (currentIdx === 0) {
        // Titular → contacto
        goTo('form_contacto', 'forward', 0);
      } else {
        // Cualquier otro (adulto o menor) → documento
        goTo('form_documento', 'forward', currentIdx);
      }
    }

    else if (fromStep === 'form_contacto') {
      // Siempre desde titular (idx 0) → documento
      goTo('form_documento', 'forward', 0);
    }

    else if (fromStep === 'form_documento') {
      const nextIdx = currentIdx + 1;

      if (nextIdx < totalAdultos) {
        // Siguiente adulto
        goTo('form_personal', 'forward', nextIdx);
      } else if (currentIdx === totalAdultos - 1 && hasMenores) {
        // Terminamos adultos → primer menor
        goTo('form_personal', 'forward', totalAdultos);
      } else if (currentIdx >= totalAdultos) {
        // Estamos en un menor → relaciones con adultos
        goTo('form_relaciones', 'forward', currentIdx);
      } else {
        // Sin menores → extras
        goTo('form_extras', 'forward', 0);
      }
    }

    else if (fromStep === 'form_relaciones') {
      const nextIdx = currentIdx + 1;

      if (nextIdx < totalAdultos + totalMenores) {
        // Siguiente menor
        goTo('form_personal', 'forward', nextIdx);
      } else {
        // Todos procesados → extras
        goTo('form_extras', 'forward', 0);
      }
    }
  }, [state, goTo]);

  // ─────────────────────────────────────────────────────────────────────────
  const nav: CheckinNav = { step, guestIndex, direction, dotSteps, dotIndex, canGoBack };

  const actions: CheckinActions = {
    goTo, goBack, goToDotIndex,
    setReservaFromTablet,
    setNumPersonas, updateGuest, updateRelacion,
    confirmKnownGuest, applyScannedData,
    setHoraLlegada, setObservaciones, nextGuest, setRgpdAcepted,
  };

  return [state, nav, actions, isLoading];
}