import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  AppMode, StepId, CheckinState, Reserva,
  GuestData, PartialGuestData, NavDirection,
} from '../types';
import { DOT_STEPS_BASE } from '../constants'; // ⚠️ ¡Fíjate! Ya no importamos MOCK_KNOWN_GUEST

// ... (Las interfaces CheckinNav y CheckinActions se mantienen iguales) ...
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

// 🛡️ DEFENSA: El estado inicial ahora nace completamente vacío y agnóstico.
function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva: null,
    knownGuest: null, // Sin datos quemados
    numPersonas: 1,
    guests: [EMPTY_GUEST],
    horaLlegada: '',
    observaciones: '',
  };
}

type HistoryEntry = { step: StepId; guestIndex: number };

// 🛡️ DEFENSA: Añadimos un boolean (isLoading) al return del hook para que la UI sepa cuándo pintar el Spinner
export function useCheckin(token: string = 'new', urlStep?: string): [CheckinState, CheckinNav, CheckinActions, boolean] {
  const navigate = useNavigate();
  
  const appMode: AppMode = token === 'new' ? 'link' : 'tablet';
  const step = (urlStep as StepId) || 'bienvenida';

  const [isLoading, setIsLoading] = useState(true);
  const [state, setState] = useState<CheckinState>(() => buildEmptyState(appMode));
  const [guestIndex, setGuestIndex] = useState(0);
  const [direction, setDirection] = useState<NavDirection>('forward');
  
  // Persistimos el historial y los permisos en Session Storage para sobrevivir al F5
  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    const saved = sessionStorage.getItem(`history_${token}`);
    return saved ? JSON.parse(saved) : [];
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    const saved = sessionStorage.getItem(`allowedSteps_${token}`);
    const parsedSteps = saved ? JSON.parse(saved) : [];
    // 🛡️ IMPORTANTE: 'tablet_buscar' y 'bienvenida' deben estar aquí DESDE EL INICIO
    return new Set([...parsedSteps, 'bienvenida', 'tablet_buscar']);
  });
  // ── 1. EFECTO: FETCH DE DATOS DESDE LA API SIMULADA ───────────────────────
  useEffect(() => {
    setIsLoading(true);
    // Hacemos una llamada HTTP real. MSW la interceptará en desarrollo.
    fetch(`/api/checkin/${token}`)
      .then(res => res.json())
      .then(response => {
        // Si el backend (MSW) nos dice que encontró al usuario, poblamos el estado
        if (response.status === 'found' && response.data) {
          setState(s => ({
            ...s,
            knownGuest: response.data,
            guests: [{ ...response.data }]
          }));
        }
      })
      .catch(err => console.error('Error cargando la reserva:', err))
      .finally(() => setIsLoading(false)); // Apagamos el loading al terminar
  }, [token]);

  // ── 2. EFECTO: GUARDAR PERMISOS EN SESSION STORAGE (Arregla el F5) ──────
  useEffect(() => {
    sessionStorage.setItem(`allowedSteps_${token}`, JSON.stringify([...allowedSteps]));
    sessionStorage.setItem(`history_${token}`, JSON.stringify(history));
  }, [allowedSteps, history, token]);

  const dotSteps = DOT_STEPS_BASE;
  const dotForStep = (s: StepId): StepId => (s === 'escanear' || s === 'confirmar_datos') ? 'form_personal' : s;
  const dotIndex = dotSteps.indexOf(dotForStep(step));

  const canGoBack = step !== 'bienvenida' && step !== 'exito' && step !== 'tablet_buscar' && history.length > 0;

// ── VIGILANTE DE LA URL (Route Guard) ─────────────────────────────────────
useEffect(() => {
  // 1. Si estamos cargando datos de la API, esperamos.
  if (isLoading) return;

  // 2. Definimos los puntos de entrada que NO necesitan validación
  const isEntryStep = step === 'bienvenida' || step === 'tablet_buscar';
  
  // 3. Si es un punto de entrada, simplemente aseguramos que esté en el Set y salimos
  if (isEntryStep) {
    if (!allowedSteps.has(step)) {
      setAllowedSteps(prev => new Set(prev).add(step));
    }
    return; 
  }

  // 4. Solo si NO es un punto de entrada Y NO tiene permiso, redirigimos
  if (!allowedSteps.has(step)) {
    console.warn(`Intento de salto ilegal al paso: ${step}`);
    const lastSafeStep = history.length > 0 ? history[history.length - 1].step : 'bienvenida';
    navigate(`/checkin/${token}/${lastSafeStep}`, { replace: true });
  }
}, [step, allowedSteps, history, navigate, token, isLoading]);

  // ── Navegación (goTo, goBack, etc.) se mantienen iguales... ───────────────
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

  const setReservaFromTablet = useCallback((res: Reserva) => {
    setState(s => {
      // Magia: Creamos el array de huéspedes vacío exacto para rellenar
      const prefilledGuests = Array(res.numHuespedes)
        .fill(null)
        .map(() => ({ ...EMPTY_GUEST }));

      return { 
        ...s, 
        reserva: res,
        numPersonas: res.numHuespedes, // <-- Guardamos el número de la BD
        guests: prefilledGuests        // <-- Preparamos las fichas vacías
      };
    });
    setHistory([]);
    setDirection('forward');
    setAllowedSteps(new Set(['bienvenida']));
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

  const confirmKnownGuest = useCallback(() => goTo('form_contacto'), [goTo]);

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
      goTo('form_personal', 'forward', currentIdx + 1);
    } else if (fromStep === 'form_documento') {
      goTo('form_extras', 'forward', 0);
    } else if (fromStep === 'form_personal') {
      goTo('form_contacto', 'forward', currentIdx);
    } else if (fromStep === 'form_contacto') {
      goTo('form_documento', 'forward', currentIdx);
    }
  }, [state.numPersonas, goTo]);

  const nav: CheckinNav = { step, guestIndex, direction, dotSteps, dotIndex, canGoBack };
  const actions: CheckinActions = {
    goTo, goBack, goToDotIndex, setReservaFromTablet, setNumPersonas,
    updateGuest, confirmKnownGuest, applyScannedData, setHoraLlegada, setObservaciones, nextGuest,
  };

  return [state, nav, actions, isLoading]; // <-- Devolvemos isLoading aquí
}