import { useState, useCallback, useEffect, useRef } from "react";
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

// ─── Tipo de acción ───────────────────────────────────────────────────────────
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

// ─── Reducer ──────────────────────────────────────────────────────────────────
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

    case "SET_RESERVA":
      return {
        ...state,
        reserva: action.reserva,
        numPersonas: action.reserva.numHuespedes, // Opcional: sincroniza el número de personas
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

// ─── Entrada del historial interno de la app ──────────────────────────────────
// IMPORTANTE: Este historial es SOLO para rastrear el guestIndex activo
// en cada step. La navegación real la gestiona React Router + browser history.
interface HistoryEntry {
  step: StepId;
  guestIndex: number;
}

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();
  const token = tokenUrl || "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  // ── Estado de la app ──────────────────────────────────────────────────────
  const [state, setState] = useState<CheckinState>(() => {
    try {
      const stored = sessionStorage.getItem(`state_${token}`);
      if (stored) return JSON.parse(stored) as CheckinState;
    } catch (err) {
      console.warn("[useCheckin] Error restoring state:", err);
    }
    return buildEmptyState(initialMode);
  });

  // ── Historial interno: solo para rastrear guestIndex por step ────────────
  // NO se usa para navegación hacia atrás (eso lo hace el browser/React Router)
  const [appHistory, setAppHistory] = useState<HistoryEntry[]>(() => {
    try {
      const st = sessionStorage.getItem(`history_${token}`);
      if (st) return JSON.parse(st) as HistoryEntry[];
    } catch (err) {
      console.warn("[useCheckin] Error restoring history:", err);
    }
    return [];
  });

  // ── Steps permitidos (para dots y panel lateral) ──────────────────────────
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

  // Ref para detectar si la última navegación fue iniciada por nosotros
  // o por el botón nativo del browser
  const isInternalNavRef = useRef(false);

  const dispatch = useCallback(
    (action: CheckinAction) => setState((prev) => checkinReducer(prev, action)),
    [],
  );

  // ── Persistencia ──────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      sessionStorage.setItem(`state_${token}`, JSON.stringify(state));
    } catch (err) {
      console.warn("[useCheckin] Error persisting state:", err);
    }
  }, [state, token]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`history_${token}`, JSON.stringify(appHistory));
    } catch (err) {
      console.warn("[useCheckin] Error persisting history:", err);
    }
  }, [appHistory, token]);

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

  // ── Carga inicial ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (token === "new") {
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/checkin/${token}`);
        const json = await res.json(); // Lo renombramos a json para mayor claridad

        // 1. Si hay datos del huésped, los guardamos
        if (json.data) {
          dispatch({ type: "SET_KNOWN_GUEST", guest: json.data });
        }

        // 2. ¡EL FIX! Si hay datos de la reserva, los guardamos
        if (json.reserva) {
          dispatch({ type: "SET_RESERVA", reserva: json.reserva });
        }
      } catch (err) {
        console.error("[useCheckin] Error loading:", err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token, dispatch]);

  // ── Detección del step y guestIndex activos ───────────────────────────────
  const actualStep =
    (stepUrl as StepId) ||
    (initialMode === "tablet" ? "tablet_buscar" : "inicio"); // ← Cambiado bienvenida por inicio

  // El guestIndex activo se lee del último entry del historial interno
  // que coincida con el step actual. Si no hay coincidencia, usamos 0.
  const activeGuestIndex = (() => {
    // Buscar de atrás hacia adelante el entry más reciente para este step
    for (let i = appHistory.length - 1; i >= 0; i--) {
      if (appHistory[i].step === actualStep) {
        return appHistory[i].guestIndex;
      }
    }
    return 0;
  })();

  // ── goTo: navega HACIA ADELANTE o realiza saltos editoriales ─────────────
  //
  // ARQUITECTURA CLAVE:
  // - "forward": push en browser history + push en appHistory
  // - "back": NO hace pop del browser history (lo hace goBack/browser).
  //           Solo registra el destino en appHistory para rastrear guestIndex.
  //           Se usa EXCLUSIVAMENTE para saltos editoriales (panel lateral → revisión)
  const goTo = useCallback(
    (nextStep: StepId, dir: NavDirection = "forward", gIdx?: number) => {
      const nextGIdx = gIdx ?? activeGuestIndex;

      // Marcar el step como permitido
      setAllowedSteps((prev) => {
        const next = new Set(prev);
        next.add(nextStep);
        return next;
      });

      isInternalNavRef.current = true;

      if (dir === "forward") {
        // Navegación normal hacia adelante
        setNavDirection("forward");
        setAppHistory((prev) => [
          ...prev,
          { step: nextStep, guestIndex: nextGIdx },
        ]);
        navigate(`/checkin/${token}/${nextStep}`);
      } else {
        // Salto editorial (ej: ir a revisión desde panel lateral)
        // Usamos replace para no crear una entrada extra en browser history
        setNavDirection("back");
        // En appHistory: añadimos el destino para que el guestIndex sea correcto
        setAppHistory((prev) => [
          ...prev,
          { step: nextStep, guestIndex: nextGIdx },
        ]);
        navigate(`/checkin/${token}/${nextStep}`, { replace: true });
      }
    },
    [navigate, token, activeGuestIndex],
  );

  // ── goBack: usa browser history nativo ────────────────────────────────────
  //
  // CLAVE: NO manipulamos appHistory aquí. Cuando React Router detecte
  // el cambio de URL (via popstate), el componente se re-renderizará con
  // el nuevo stepUrl, y activeGuestIndex se calculará automáticamente
  // buscando en appHistory el entry más reciente para ese step.
  const goBack = useCallback(() => {
    isInternalNavRef.current = true;
    setNavDirection("back");
    navigate(-1); // ← Delegamos 100% al browser history
  }, [navigate]);

  // ── Detectar navegación nativa del browser (botón atrás del móvil) ───────
  // Cuando el usuario usa el botón nativo, React Router actualiza la URL
  // pero nosotros necesitamos actualizar navDirection
  useEffect(() => {
    const handlePopState = () => {
      if (!isInternalNavRef.current) {
        // Navegación nativa (botón atrás del móvil/browser)
        setNavDirection("back");
      }
      isInternalNavRef.current = false;
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // ── canGoBack: true si hay historial browser disponible ──────────────────
  // Usamos appHistory.length como proxy: si hemos navegado al menos una vez,
  // hay historial browser para volver
  const canGoBack =
    appHistory.length > 0 &&
    actualStep !== "exito" &&
    actualStep !== "tablet_buscar" &&
    actualStep !== "inicio";
  // ── Dots ──────────────────────────────────────────────────────────────────
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
    canGoBack,
    allowedSteps,
  };

  // ── nextGuest ─────────────────────────────────────────────────────────────
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
          const mIdx = guests.findIndex((g) => g.esMenor);
          if (mIdx >= 0) {
            goTo("form_relaciones", "forward", mIdx);
          } else {
            goTo("form_extras", "forward", 0);
          }
        }
      } else if (from === "form_contacto") {
        if (numPersonas > 1) {
          goTo("form_personal", "forward", 1);
        } else {
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

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = {
    goTo,
    goBack,

    goToDotIndex: (idx: number) => {
      if (idx < 0 || idx >= dotSteps.length) return;
      const targetStep = dotSteps[idx];
      const isBack = idx < currentDotIndex;
      if (isBack) {
        // Navegación hacia atrás: usamos goTo con replace para no acumular
        // entradas en browser history
        goTo(targetStep, "back", 0);
      } else {
        goTo(targetStep, "forward", 0);
      }
    },

    setReservaFromTablet: (res: Reserva) => {
      dispatch({ type: "SET_RESERVA_TABLET", reserva: res });
      // Reset del historial interno al iniciar un nuevo flujo
      setAppHistory([{ step: "bienvenida", guestIndex: 0 }]);
      setAllowedSteps(new Set<StepId>(["bienvenida", "tablet_buscar"]));
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
