import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import type {
  CheckinState,
  AppMode,
  Reserva,
  GuestData,
  PartialGuestData,
  StepId,
  CheckinNav,
  NavDirection,
  CheckinActions,
} from "@/types";
import { FLOW_STEPS_LINK, DOT_STEPS_BASE } from "@/constants";
import { loadCheckinData } from "@/api/chekin.service";
import { loginGuest } from "@/api/auth.service";

// ── Persistencia en sesión ────────────────────────────────────────────────────
function getSession<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function setSession<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ── Tipos y Estado inicial ────────────────────────────────────────────────────
export type CheckinAction =
  | { type: "SET_KNOWN_GUEST"; guest: GuestData }
  | { type: "SET_RESERVA_TABLET"; reserva: Reserva }
  | { type: "SET_RESERVA"; reserva: Reserva }
  | { type: "SET_NUM_PERSONAS"; total: number }
  | {
      type: "UPDATE_GUEST";
      index: number;
      key: keyof PartialGuestData;
      value: unknown;
    }
  | {
      type: "UPDATE_RELACION";
      menorIndex: number;
      adultoIndex: number;
      parentesco: string;
    }
  | { type: "APPLY_SCAN"; data: Partial<GuestData>; guestIdx: number }
  | { type: "SET_HORA_LLEGADA"; value: string }
  | { type: "SET_OBSERVACIONES"; value: string }
  | { type: "SET_RGPD"; value: boolean }
  | { type: "SET_LEGAL_PASSED"; value: boolean }
  | { type: "SET_HAS_MINORS_FLAG"; value: boolean }
  | { type: "RESTORE_FULL_STATE"; payload: CheckinState }
  | { type: "RESET" };

interface HistoryEntry {
  step: StepId;
  guestIndex: number;
}

export function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva: null,
    knownGuest: null,
    numAdultos: 1,
    numMenores: 0,
    numPersonas: 1,
    guests: [{ esMenor: false, relacionesConAdultos: [] }],
    horaLlegada: "",
    observaciones: "",
    rgpdAcepted: false,
    legalPassed: false,
    hasMinorsFlag: false,
  };
}

function mergeGuests(
  prev: PartialGuestData[],
  total: number,
): PartialGuestData[] {
  return Array.from(
    { length: total },
    (_, i) => prev[i] ?? { esMenor: false, relacionesConAdultos: [] },
  );
}

// ── Reducer ───────────────────────────────────────────────────────────────────
export function checkinReducer(
  state: CheckinState,
  action: CheckinAction,
): CheckinState {
  switch (action.type) {
    case "SET_KNOWN_GUEST":
      return {
        ...state,
        knownGuest: action.guest,
        guests: [{ ...action.guest, esMenor: false }],
      };
    case "SET_RESERVA_TABLET":
      return {
        ...state,
        reserva: action.reserva,
        numPersonas: action.reserva.numHuespedes,
        numAdultos: action.reserva.numHuespedes,
        numMenores: 0,
        guests: mergeGuests([], action.reserva.numHuespedes),
      };
    case "SET_RESERVA":
      return {
        ...state,
        reserva: action.reserva,
        numPersonas: action.reserva.numHuespedes,
      };
    case "SET_NUM_PERSONAS": {
      const newGuests = mergeGuests(state.guests ?? [], action.total);
      return {
        ...state,
        numPersonas: action.total,
        guests: newGuests,
        numAdultos: newGuests.filter((g) => !g.esMenor).length,
        numMenores: newGuests.filter((g) => g.esMenor).length,
      };
    }
    case "UPDATE_GUEST": {
      const guests = [...state.guests];
      let finalValue = action.value;
      if (typeof finalValue === "string")
        finalValue = finalValue.replace(/\s+/g, " ").trim();
      const updated = { ...guests[action.index], [action.key]: finalValue };
      if (action.key === "fechaNac" && typeof finalValue === "string") {
        const parsed = dayjs(finalValue);
        if (parsed.isValid())
          updated.esMenor = dayjs().diff(parsed, "years") < 18;
      }
      guests[action.index] = updated;
      return { ...state, guests };
    }
    case "UPDATE_RELACION": {
      const guests = [...state.guests];
      const menor = { ...guests[action.menorIndex] };
      const rels = [...(menor.relacionesConAdultos ?? [])];
      if (action.parentesco === "") {
        menor.relacionesConAdultos = rels.filter(
          (r) => r.adultoIndex !== action.adultoIndex,
        );
      } else {
        const idx = rels.findIndex((r) => r.adultoIndex === action.adultoIndex);
        if (idx >= 0)
          rels[idx] = { ...rels[idx], parentesco: action.parentesco };
        else
          rels.push({
            adultoIndex: action.adultoIndex,
            parentesco: action.parentesco,
          });
        menor.relacionesConAdultos = rels;
      }
      guests[action.menorIndex] = menor;
      return { ...state, guests };
    }
    case "APPLY_SCAN": {
      const guests = [...state.guests];
      guests[action.guestIdx] = { ...guests[action.guestIdx], ...action.data };
      return { ...state, guests };
    }
    case "SET_HORA_LLEGADA":
      return { ...state, horaLlegada: action.value };
    case "SET_OBSERVACIONES":
      return { ...state, observaciones: action.value };
    case "SET_RGPD":
      return { ...state, rgpdAcepted: action.value };
    case "SET_LEGAL_PASSED":
      return { ...state, legalPassed: action.value };
    case "SET_HAS_MINORS_FLAG":
      return { ...state, hasMinorsFlag: action.value };
    case "RESTORE_FULL_STATE":
      return { ...state, ...action.payload };
    case "RESET":
      return buildEmptyState(state.appMode);
    default:
      return state;
  }
}

// ── Hook Principal ────────────────────────────────────────────────────────────
export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();
  const token = tokenUrl ?? "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  const [state, setState] = useState<CheckinState>(() =>
    getSession(`state_${token}`, buildEmptyState(initialMode)),
  );
  const [appHistory, setAppHistory] = useState<HistoryEntry[]>(() =>
    getSession(`history_${token}`, []),
  );
  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    const stored = getSession<StepId[] | null>(`allowedSteps_${token}`, null);
    return new Set(stored ?? ["inicio", "tablet_buscar"]);
  });
  const [isLoading, setIsLoading] = useState(token !== "new");
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");
  const [isNavigating, setIsNavigating] = useState(false);

  const stateRef = useRef(state);
  const isInternalNavRef = useRef(false);
  const navigateRef = useRef(navigate);

  // Mantiene navigateRef siempre actualizado sin añadirlo a deps del efecto de carga
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => setSession(`state_${token}`, state), [state, token]);
  useEffect(
    () => setSession(`history_${token}`, appHistory),
    [appHistory, token],
  );
  useEffect(
    () => setSession(`allowedSteps_${token}`, Array.from(allowedSteps)),
    [allowedSteps, token],
  );

  const dispatch = useCallback(
    (action: CheckinAction) => setState((prev) => checkinReducer(prev, action)),
    [],
  );

  // ── Carga con Login Automático ────────────────────────────────────────────
  useEffect(() => {
    if (token === "new") {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const yaAutenticado =
          sessionStorage.getItem("lumina_access_token") ??
          localStorage.getItem("lumina_access_token");

        if (!yaAutenticado) {
          try {
            await loginGuest(token, "");
          } catch (authErr) {
            console.error("[useCheckin] ❌ LOGIN FALLIDO:", authErr);
            if (!cancelled) navigateRef.current("/invalid", { replace: true });
            return;
          }
        }

        const result = await loadCheckinData(token);

        if (cancelled) return;

        if (result.knownGuest)
          dispatch({ type: "SET_KNOWN_GUEST", guest: result.knownGuest });
        dispatch({ type: "SET_RESERVA", reserva: result.reserva });

        sessionStorage.setItem(`bookingId_${token}`, String(result.bookingId));
        if (result.clientId)
          sessionStorage.setItem(`clientId_${token}`, String(result.clientId));

      } catch (err) {
        if (cancelled) return;
        console.error("[useCheckin] ❌ ERROR AL CARGAR RESERVA:", err);
        navigateRef.current("/invalid", { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  // navigate se excluye de deps intencionadamente — se accede via navigateRef
  // para evitar que re-ejecute load() en cada navegación
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dispatch]);

  const actualStep =
    (stepUrl as StepId) ??
    (initialMode === "tablet" ? "tablet_buscar" : "inicio");

  const activeGuestIndex = (() => {
    for (let i = appHistory.length - 1; i >= 0; i--) {
      if (appHistory[i].step === actualStep) return appHistory[i].guestIndex;
    }
    return 0;
  })();

  const goTo = useCallback(
    (nextStep: StepId, dir: NavDirection = "forward", gIdx?: number) => {
      if (isNavigating) return;
      setIsNavigating(true);
      setAllowedSteps((prev) => new Set(prev).add(nextStep));
      isInternalNavRef.current = true;
      setNavDirection(dir);
      setAppHistory((prev) => [
        ...prev,
        { step: nextStep, guestIndex: gIdx ?? activeGuestIndex },
      ]);
      if (dir === "forward") navigate(`/checkin/${token}/${nextStep}`);
      else navigate(`/checkin/${token}/${nextStep}`, { replace: true });
      setTimeout(() => setIsNavigating(false), 350);
    },
    [navigate, token, activeGuestIndex, isNavigating],
  );

  const goBack = useCallback(() => {
    isInternalNavRef.current = true;
    setNavDirection("back");
    setAppHistory((prev) => {
      if (prev.length > 1) {
        const next = prev.slice(0, -1);
        navigate(`/checkin/${token}/${next[next.length - 1].step}`, {
          replace: true,
        });
        return next;
      }
      navigate(-1);
      return prev;
    });
  }, [navigate, token]);

  useEffect(() => {
    const onPop = () => {
      if (!isInternalNavRef.current) setNavDirection("back");
      isInternalNavRef.current = false;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const nextGuest = useCallback(
    (currIdx: number, from: StepId) => {
      const { guests, numPersonas } = stateRef.current;
      if (from === "form_personal") {
        if (currIdx === 0) return goTo("form_contacto", "forward", 0);
        if (currIdx + 1 < numPersonas)
          return goTo("form_personal", "forward", currIdx + 1);
      }
      if (from === "form_contacto" && numPersonas > 1)
        return goTo("form_personal", "forward", 1);
      if (
        ["form_personal", "form_contacto", "form_relaciones"].includes(from)
      ) {
        const nextM =
          from === "form_relaciones"
            ? guests.findIndex((g, i) => i > currIdx && g.esMenor)
            : guests.findIndex((g) => g.esMenor);
        if (nextM >= 0) return goTo("form_relaciones", "forward", nextM);
        return goTo("form_extras", "forward", 0);
      }
    },
    [goTo],
  );

  const dotSteps = useMemo(() => {
    const base = state.appMode === "link" ? FLOW_STEPS_LINK : DOT_STEPS_BASE;
    const flujo = sessionStorage.getItem(`modoFlujo_${token}`);
    return flujo === "manual" ? base.filter((s) => s !== "escanear") : base;
  }, [state.appMode, token, actualStep]);

  const canGoBack =
    appHistory.length > 0 &&
    !["exito", "tablet_buscar", "inicio"].includes(actualStep);

  let currentDotIndex = dotSteps.indexOf(actualStep);
  if (["confirmar_datos", "form_relaciones"].includes(actualStep)) {
    currentDotIndex = dotSteps.indexOf("form_personal");
  }

  const nav: CheckinNav = useMemo(
    () => ({
      step: actualStep,
      guestIndex: activeGuestIndex,
      direction: navDirection,
      dotSteps,
      dotIndex: currentDotIndex,
      canGoBack,
      allowedSteps,
      isNavigating,
    }),
    [
      actualStep,
      activeGuestIndex,
      navDirection,
      dotSteps,
      currentDotIndex,
      canGoBack,
      allowedSteps,
      isNavigating,
    ],
  );

  const actions: CheckinActions = useMemo(
    () => ({
      goTo,
      goBack,
      goToDotIndex: (idx: number) => {
        if (idx < 0 || idx >= dotSteps.length) return;
        goTo(dotSteps[idx], idx < currentDotIndex ? "back" : "forward", 0);
      },
      setReservaFromTablet: (res: Reserva) => {
        dispatch({ type: "SET_RESERVA_TABLET", reserva: res });
        setAppHistory([{ step: "bienvenida", guestIndex: 0 }]);
        setAllowedSteps(new Set(["bienvenida", "tablet_buscar"]));
        goTo("bienvenida", "forward", 0);
      },
      setNumPersonas: (total) => dispatch({ type: "SET_NUM_PERSONAS", total }),
      updateGuest: (index, key, value) =>
        dispatch({ type: "UPDATE_GUEST", index, key, value }),
      updateRelacion: (menorIndex, adultoIndex, parentesco) =>
        dispatch({
          type: "UPDATE_RELACION",
          menorIndex,
          adultoIndex,
          parentesco,
        }),
      confirmKnownGuest: () => {
        const { knownGuest } = stateRef.current;
        if (knownGuest)
          dispatch({ type: "SET_KNOWN_GUEST", guest: knownGuest });
      },
      applyScannedData: (data, idx) =>
        dispatch({
          type: "APPLY_SCAN",
          data,
          guestIdx: idx ?? activeGuestIndex,
        }),
      setHoraLlegada: (v) => dispatch({ type: "SET_HORA_LLEGADA", value: v }),
      setObservaciones: (v) =>
        dispatch({ type: "SET_OBSERVACIONES", value: v }),
      nextGuest,
      setRgpdAcepted: (v) => dispatch({ type: "SET_RGPD", value: v }),
      setLegalPassed: (v) => dispatch({ type: "SET_LEGAL_PASSED", value: v }),
      setHasMinorsFlag: (v) =>
        dispatch({ type: "SET_HAS_MINORS_FLAG", value: v }),
    }),
    [
      goTo,
      goBack,
      dispatch,
      dotSteps,
      currentDotIndex,
      nextGuest,
      activeGuestIndex,
    ],
  );

  return [state, nav, actions, isLoading] as const;
}