import { useState, useCallback, useEffect } from "react";
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
} from "@/types";
import { FLOW_STEPS_LINK, DOT_STEPS_BASE } from "@/constants";

// ─── Tipo de acción (única fuente de verdad) ──────────────────────────────────
export type CheckinAction =
  | { type: "SET_KNOWN_GUEST"; guest: GuestData }
  | { type: "SET_RESERVA_TABLET"; reserva: Reserva }
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

// ─── Estado vacío ─────────────────────────────────────────────────────────────
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

function makeGuests(total: number): PartialGuestData[] {
  return Array.from({ length: total }, () => ({
    esMenor: false,
    relacionesConAdultos: [],
  }));
}

function mergeGuests(
  prev: PartialGuestData[],
  total: number,
): PartialGuestData[] {
  return Array.from(
    { length: total },
    (_, i) => prev[i] || { esMenor: false, relacionesConAdultos: [] },
  );
}

// ─── Reducer (única implementación) ──────────────────────────────────────────
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
        guests: makeGuests(action.reserva.numHuespedes),
      };

    case "SET_NUM_PERSONAS": {
      const newGuests = mergeGuests(state.guests || [], action.total);
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
      if (typeof finalValue === "string") {
        finalValue = finalValue.replace(/\s+/g, " ").trim();
      }

      const updated = { ...guests[action.index], [action.key]: finalValue };

      if (action.key === "fechaNac" && typeof finalValue === "string") {
        const parsed = dayjs(finalValue);
        if (parsed.isValid()) {
          updated.esMenor = dayjs().diff(parsed, "years") < 18;
        }
      }

      guests[action.index] = updated;
      return { ...state, guests };
    }

    case "UPDATE_RELACION": {
      const guests = [...state.guests];
      const menor = { ...guests[action.menorIndex] };
      const rels = [...(menor.relacionesConAdultos || [])];

      if (action.parentesco === "") {
        menor.relacionesConAdultos = rels.filter(
          (r) => r.adultoIndex !== action.adultoIndex,
        );
      } else {
        const idx = rels.findIndex((r) => r.adultoIndex === action.adultoIndex);
        if (idx >= 0) {
          rels[idx] = { ...rels[idx], parentesco: action.parentesco };
        } else {
          rels.push({
            adultoIndex: action.adultoIndex,
            parentesco: action.parentesco,
          });
        }
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

// ─── Entrada del historial ────────────────────────────────────────────────────
interface HistoryEntry {
  step: StepId;
  guestIndex: number;
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();
  const token = tokenUrl || "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  const [state, setState] = useState<CheckinState>(() => {
    try {
      const stored = sessionStorage.getItem(`state_${token}`);
      if (stored) return JSON.parse(stored) as CheckinState;
    } catch (err) {
      console.warn("[useCheckin] Error restoring state:", err);
    }
    return buildEmptyState(initialMode);
  });

  const [history, setHistory] = useState<HistoryEntry[]>(() => {
    try {
      const st = sessionStorage.getItem(`history_${token}`);
      if (st) return JSON.parse(st) as HistoryEntry[];
    } catch (err) {
      console.warn("[useCheckin] Error restoring history:", err);
    }
    return [];
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    try {
      const st = sessionStorage.getItem(`allowedSteps_${token}`);
      if (st) {
        const parsed = JSON.parse(st);
        if (Array.isArray(parsed)) return new Set<StepId>(parsed);
      }
    } catch (err) {
      console.warn("[useCheckin] Error restoring allowedSteps:", err);
    }
    return new Set<StepId>(["inicio", "tablet_buscar"]);
  });

  const [isLoading, setIsLoading] = useState(token !== "new");
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");

  const dispatch = useCallback(
    (action: CheckinAction) => setState((prev) => checkinReducer(prev, action)),
    [],
  );

  // Persistencia
  useEffect(() => {
    try {
      sessionStorage.setItem(`state_${token}`, JSON.stringify(state));
    } catch (err) {
      console.warn("[useCheckin] Error persisting state:", err);
    }
  }, [state, token]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`history_${token}`, JSON.stringify(history));
    } catch (err) {
      console.warn("[useCheckin] Error persisting history:", err);
    }
  }, [history, token]);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        `allowedSteps_${token}`,
        JSON.stringify(Array.from(allowedSteps)),
      );
    } catch (err) {
      console.warn("[useCheckin] Error persisting allowedSteps:", err);
    }
  }, [allowedSteps, token]);

  // Carga inicial
  useEffect(() => {
    if (token === "new") {
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/checkin/${token}`);
        const data = (await res.json()) as any;

        if (data.status === "partial_recovery" && data.state) {
          dispatch({ type: "RESTORE_FULL_STATE", payload: data.state });

          const stepsToUnlock: StepId[] = [
            "inicio",
            "bienvenida",
            "num_personas",
            "escanear",
            "form_personal",
            "form_contacto",
            "form_documento",
            "form_relaciones",
            "form_extras",
            "revision",
          ];

          setAllowedSteps(new Set(stepsToUnlock));

          setHistory([
            { step: "inicio", guestIndex: 0 },
            { step: "revision", guestIndex: 0 },
          ]);
          navigate(`/checkin/${token}/revision`, { replace: true });
        } else if (data.data) {
          dispatch({ type: "SET_KNOWN_GUEST", guest: data.data });
        }
      } catch (err) {
        console.error("[useCheckin] Error loading:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token, dispatch]);

  // 1. Cambiamos el paso por defecto en la carga inicial (alrededor de la línea 193)
  const actualStep =
    (stepUrl as StepId) ||
    (initialMode === "tablet" ? "tablet_buscar" : "inicio"); // ← Cambiado bienvenida por inicio

  const activeGuestIndex =
    history.length > 0 ? history[history.length - 1].guestIndex : 0;

  // ─── FIX BUG CRÍTICO #3: goTo con navegación de historial correcta ──────────
  // Antes: dir="back" hacía pop() pero no push del destino → historial roto.
  // Ahora: forward siempre push, back siempre pop (el destino ya está en el historial).
  const goTo = useCallback(
    (nextStep: StepId, dir: NavDirection = "forward", gIdx?: number) => {
      setNavDirection(dir);
      const nextGIdx = gIdx ?? activeGuestIndex;

      setAllowedSteps((prev) => {
        const next = new Set(prev);
        next.add(nextStep);
        return next;
      });

      if (dir === "forward") {
        setHistory((prev) => [
          ...prev,
          { step: nextStep, guestIndex: nextGIdx },
        ]);
      }
      // En "back", el historial se maneja desde goBack, no aquí.
      // goTo con "back" solo se usa para saltos editoriales (ej: ir a revisión
      // desde el panel lateral), en ese caso actualizamos el último entry.
      if (dir === "back") {
        setHistory((prev) => {
          if (prev.length === 0)
            return [{ step: nextStep, guestIndex: nextGIdx }];
          // Reemplazamos el último entry con el destino
          return [
            ...prev.slice(0, -1),
            { step: nextStep, guestIndex: nextGIdx },
          ];
        });
      }

      navigate(`/checkin/${token}/${nextStep}`, { replace: false });
    },
    [navigate, token, activeGuestIndex],
  );

  const goBack = useCallback(() => {
    if (history.length <= 1) return;
    const target = history[history.length - 2];
    setHistory((prev) => prev.slice(0, -1));
    setNavDirection("back");
    if (target)
      navigate(`/checkin/${token}/${target.step}`, { replace: false });
  }, [navigate, token, history]);

  const dotSteps = state.appMode === "link" ? FLOW_STEPS_LINK : DOT_STEPS_BASE;

  let currentDotIndex = dotSteps.indexOf(actualStep);
  if (
    actualStep === "confirmar_datos" ||
    actualStep === "escanear" ||
    actualStep === "form_relaciones"
  ) {
    currentDotIndex = dotSteps.indexOf("form_personal");
  }

  const nav: CheckinNav = {
    step: actualStep,
    guestIndex: activeGuestIndex,
    direction: navDirection,
    dotSteps,
    dotIndex: currentDotIndex,
    canGoBack: history.length > 1 && actualStep !== "exito",
    allowedSteps,
  };

  // ─── FIX BUG HIGH #5: nextGuest con lógica de menores en form_contacto ───
  const nextGuest = useCallback(
    (currIdx: number, from: StepId) => {
      const guests = state.guests;
      const numPersonas = state.numPersonas;

      if (from === "form_personal") {
        if (currIdx === 0) {
          goTo("form_contacto", "forward", 0);
        } else if (currIdx + 1 < numPersonas) {
          goTo("form_personal", "forward", currIdx + 1);
        } else {
          // Todos los guests procesados → buscar menores
          const mIdx = guests.findIndex((g) => g.esMenor);
          if (mIdx >= 0) {
            goTo("form_relaciones", "forward", mIdx);
          } else {
            goTo("form_extras", "forward", 0);
          }
        }
      } else if (from === "form_contacto") {
        // FIX: antes saltaba a form_personal con idx=1 sin comprobar menores
        if (numPersonas > 1) {
          goTo("form_personal", "forward", 1);
        } else {
          // Un solo huésped: comprobar si es menor para relaciones
          const mIdx = guests.findIndex((g) => g.esMenor);
          if (mIdx >= 0) {
            goTo("form_relaciones", "forward", mIdx);
          } else {
            goTo("form_extras", "forward", 0);
          }
        }
      } else if (from === "form_relaciones") {
        const nextM = guests.findIndex((g, i) => i > currIdx && g.esMenor);
        if (nextM >= 0) {
          goTo("form_relaciones", "forward", nextM);
        } else {
          goTo("form_extras", "forward", 0);
        }
      }
    },
    [state.guests, state.numPersonas, goTo],
  );

  const actions = {
    goTo,
    goBack,

    goToDotIndex: (idx: number) => {
      if (idx < 0 || idx >= dotSteps.length) return;
      const targetStep = dotSteps[idx];
      const isBack = idx < currentDotIndex;
      goTo(targetStep, isBack ? "back" : "forward", activeGuestIndex);
    },

    setReservaFromTablet: (res: Reserva) => {
      dispatch({ type: "SET_RESERVA_TABLET", reserva: res });
      goTo("bienvenida", "forward", 0);
    },

    setNumPersonas: (total: number) =>
      dispatch({ type: "SET_NUM_PERSONAS", total }),

    updateGuest: (index: number, key: keyof PartialGuestData, value: unknown) =>
      dispatch({ type: "UPDATE_GUEST", index, key, value }),

    updateRelacion: (mIdx: number, aIdx: number, p: string) =>
      dispatch({
        type: "UPDATE_RELACION",
        menorIndex: mIdx,
        adultoIndex: aIdx,
        parentesco: p,
      }),

    // FIX BUG HIGH #2: confirmKnownGuest implementado (faltaba en el hook)
    confirmKnownGuest: () => {
      if (state.knownGuest) {
        dispatch({ type: "SET_KNOWN_GUEST", guest: state.knownGuest });
      }
    },

    applyScannedData: (data: Partial<GuestData>, idx?: number) =>
      dispatch({
        type: "APPLY_SCAN",
        data,
        guestIdx: idx ?? activeGuestIndex,
      }),

    setHoraLlegada: (v: string) =>
      dispatch({ type: "SET_HORA_LLEGADA", value: v }),

    setObservaciones: (v: string) =>
      dispatch({ type: "SET_OBSERVACIONES", value: v }),

    nextGuest,

    setRgpdAcepted: (v: boolean) => dispatch({ type: "SET_RGPD", value: v }),
    setLegalPassed: (v: boolean) =>
      dispatch({ type: "SET_LEGAL_PASSED", value: v }),
    setHasMinorsFlag: (v: boolean) =>
      dispatch({ type: "SET_HAS_MINORS_FLAG", value: v }),
  };

  return [state, nav, actions, isLoading] as const;
}
