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

// ─── Acciones ────────────────────────────────────────────────────────────────
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
  | { type: "RESET" };

// ─── Helpers ─────────────────────────────────────────────────────────────────
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
  return Array.from({ length: total }, (_, i) => {
    return prev[i] || { esMenor: false, relacionesConAdultos: [] };
  });
}

// ─── Reducer ─────────────────────────────────────────────────────────────────
export function checkinReducer(
  state: CheckinState,
  action: CheckinAction,
): CheckinState {
  switch (action.type) {
    case "SET_KNOWN_GUEST":
      return {
        ...state,
        reserva: null,
        knownGuest: action.guest,
        numAdultos: 1,
        numMenores: 0,
        numPersonas: 1,
        guests: [{ ...action.guest, esMenor: false, relacionesConAdultos: [] }],
        horaLlegada: "",
        observaciones: "",
        rgpdAcepted: false,
      };

    case "SET_RESERVA_TABLET":
      return {
        ...state,
        reserva: action.reserva,
        numAdultos: action.reserva.numHuespedes,
        numMenores: 0,
        numPersonas: action.reserva.numHuespedes,
        guests: makeGuests(action.reserva.numHuespedes),
        horaLlegada: "",
        observaciones: "",
        rgpdAcepted: false,
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
      const updatedGuest = {
        ...guests[action.index],
        [action.key]: action.value,
      };

      if (action.key === "fechaNac" && typeof action.value === "string") {
        const parsed = dayjs(action.value);
        if (parsed.isValid()) {
          const isMinor = dayjs().diff(parsed, "years") < 18;
          updatedGuest.esMenor = isMinor;
          if (!isMinor) updatedGuest.relacionesConAdultos = [];
        }
      }

      guests[action.index] = updatedGuest;
      return {
        ...state,
        guests,
        numAdultos: guests.filter((g) => !g.esMenor).length,
        numMenores: guests.filter((g) => g.esMenor).length,
      };
    }

    case "UPDATE_RELACION": {
      const guests = [...state.guests];
      const menor = { ...guests[action.menorIndex] };
      const rels = menor.relacionesConAdultos
        ? [...menor.relacionesConAdultos]
        : [];

      const existingIdx = rels.findIndex(
        (r) => r.adultoIndex === action.adultoIndex,
      );
      if (existingIdx >= 0) {
        rels[existingIdx] = {
          ...rels[existingIdx],
          parentesco: action.parentesco,
        };
      } else {
        rels.push({
          adultoIndex: action.adultoIndex,
          parentesco: action.parentesco,
        });
      }

      menor.relacionesConAdultos = rels;
      guests[action.menorIndex] = menor;
      return { ...state, guests };
    }

    case "APPLY_SCAN": {
      const guests = [...state.guests];
      const updatedGuest = { ...guests[action.guestIdx], ...action.data };

      if (updatedGuest.fechaNac) {
        const parsed = dayjs(updatedGuest.fechaNac);
        if (parsed.isValid()) {
          const isMinor = dayjs().diff(parsed, "years") < 18;
          updatedGuest.esMenor = isMinor;
          if (!isMinor) updatedGuest.relacionesConAdultos = [];
        }
      }

      guests[action.guestIdx] = updatedGuest;
      return {
        ...state,
        guests,
        numAdultos: guests.filter((g) => !g.esMenor).length,
        numMenores: guests.filter((g) => g.esMenor).length,
      };
    }

    case "SET_HORA_LLEGADA":
      return { ...state, horaLlegada: action.value };
    case "SET_OBSERVACIONES":
      return { ...state, observaciones: action.value };
    case "SET_RGPD":
      return { ...state, rgpdAcepted: action.value };
    case "RESET":
      return buildEmptyState(state.appMode);
    default:
      return state;
  }
}

// ─── Hook Principal ──────────────────────────────────────────────────────────
export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();

  const token = tokenUrl || "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  const [state, setState] = useState<CheckinState>(() => {
    try {
      const stored = sessionStorage.getItem(`state_${token}`);
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn("Failed to parse state", err);
    }
    return buildEmptyState(initialMode);
  });

  const [history, setHistory] = useState<
    { step: StepId; guestIndex: number }[]
  >(() => {
    try {
      const st = sessionStorage.getItem(`history_${token}`);
      if (st) return JSON.parse(st);
    } catch (err) {
      console.warn("Failed to parse history", err);
    }
    return [];
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    try {
      const st = sessionStorage.getItem(`allowedSteps_${token}`);
      if (st) return new Set(JSON.parse(st));
    } catch (err) {
      console.warn("Failed to parse allowedSteps", err);
    }
    return new Set(["bienvenida", "tablet_buscar"]);
  });

  const [isLoading, setIsLoading] = useState(token !== "new");

  const dispatch = useCallback((action: CheckinAction) => {
    setState((prev) => checkinReducer(prev, action));
  }, []);

  useEffect(() => {
    sessionStorage.setItem(`state_${token}`, JSON.stringify(state));
  }, [state, token]);
  useEffect(() => {
    sessionStorage.setItem(`history_${token}`, JSON.stringify(history));
  }, [history, token]);
  useEffect(() => {
    sessionStorage.setItem(
      `allowedSteps_${token}`,
      JSON.stringify(Array.from(allowedSteps)),
    );
  }, [allowedSteps, token]);

  useEffect(() => {
    let active = true;
    async function loadData() {
      if (token === "new") {
        setIsLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/checkin/${token}`);
        if (!res.ok) throw new Error("Error loading data");
        const data = await res.json();
        if (active && data.data)
          dispatch({ type: "SET_KNOWN_GUEST", guest: data.data });
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setIsLoading(false);
      }
    }
    if (isLoading) loadData();
    return () => {
      active = false;
    };
  }, [token, isLoading, dispatch]);

  const actualStep =
    (stepUrl as StepId) ||
    (initialMode === "tablet" ? "tablet_buscar" : "bienvenida");
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");
  const activeGuestIndex =
    history.length > 0 ? history[history.length - 1].guestIndex : 0;

  const goTo = useCallback(
    (nextStep: StepId, dir: NavDirection = "forward", gIdx?: number) => {
      setNavDirection(dir);
      const nextGIdx = gIdx ?? activeGuestIndex;

      setHistory((prev) => {
        const h = [...prev];
        if (dir === "forward") h.push({ step: nextStep, guestIndex: nextGIdx });
        else if (h.length > 0) h.pop();
        return h;
      });

      setAllowedSteps((prev) => {
        const next = new Set(prev);
        next.add(nextStep);
        return next;
      });

      navigate(`/checkin/${token}/${nextStep}`, { replace: true });
    },
    [navigate, token, activeGuestIndex],
  );

  const goBack = useCallback(() => {
    if (history.length > 1) {
      const prev = history[history.length - 2];
      goTo(prev.step, "back", prev.guestIndex);
    }
  }, [history, goTo]);

  const dotSteps = state.appMode === "link" ? FLOW_STEPS_LINK : DOT_STEPS_BASE;
  let dotIndex = dotSteps.indexOf(actualStep);
  if (
    actualStep === "confirmar_datos" ||
    actualStep === "escanear" ||
    actualStep === "form_relaciones"
  ) {
    dotIndex = dotSteps.indexOf("form_personal");
  }

  const goToDotIndex = useCallback(
    (targetIdx: number) => {
      if (targetIdx < 0 || targetIdx >= dotSteps.length) return;
      const targetStep = dotSteps[targetIdx];
      const isBack = targetIdx < dotIndex;
      goTo(targetStep, isBack ? "back" : "forward", activeGuestIndex);
    },
    [dotSteps, dotIndex, goTo, activeGuestIndex],
  );

  const setReservaFromTablet = useCallback(
    (res: Reserva) => {
      dispatch({ type: "SET_RESERVA_TABLET", reserva: res });
      goTo("bienvenida", "forward");
    },
    [dispatch, goTo],
  );

  const setNumPersonas = useCallback(
    (total: number) => {
      dispatch({ type: "SET_NUM_PERSONAS", total });
    },
    [dispatch],
  );

  const updateGuest = useCallback(
    (index: number, key: keyof PartialGuestData, value: unknown) => {
      dispatch({ type: "UPDATE_GUEST", index, key, value });
    },
    [dispatch],
  );

  const updateRelacion = useCallback(
    (menorIndex: number, adultoIndex: number, parentesco: string) => {
      dispatch({
        type: "UPDATE_RELACION",
        menorIndex,
        adultoIndex,
        parentesco,
      });
    },
    [dispatch],
  );

  const applyScannedData = useCallback(
    (data: Partial<GuestData>, guestIdx?: number) => {
      dispatch({
        type: "APPLY_SCAN",
        data,
        guestIdx: guestIdx ?? activeGuestIndex,
      });
    },
    [dispatch, activeGuestIndex],
  );

  const nextGuest = useCallback(
    (currentIdx: number, fromStep: StepId) => {
      const { numPersonas, guests } = state;

      if (fromStep === "form_personal") {
        if (currentIdx === 0) {
          goTo("form_contacto", "forward", 0);
        } else if (currentIdx + 1 < numPersonas) {
          goTo("form_personal", "forward", currentIdx + 1);
        } else {
          const firstMinorIdx = guests.findIndex((g) => g.esMenor);
          if (firstMinorIdx >= 0)
            goTo("form_relaciones", "forward", firstMinorIdx);
          else goTo("form_extras", "forward", 0);
        }
      } else if (fromStep === "form_contacto") {
        if (numPersonas > 1) {
          goTo("form_personal", "forward", 1);
        } else {
          goTo("form_extras", "forward", 0);
        }
      } else if (fromStep === "form_relaciones") {
        const nextMinorIdx = guests.findIndex(
          (g, i) => i > currentIdx && g.esMenor,
        );
        if (nextMinorIdx >= 0) {
          goTo("form_relaciones", "forward", nextMinorIdx);
        } else {
          goTo("form_extras", "forward", 0);
        }
      }
    },
    [state, goTo],
  );

  const nav: CheckinNav = {
    step: actualStep,
    guestIndex: activeGuestIndex,
    direction: navDirection,
    dotSteps,
    dotIndex,
    canGoBack: history.length > 1 && actualStep !== "exito",
    allowedSteps,
  };

  const checkinActions = {
    goTo,
    goBack,
    goToDotIndex,
    setReservaFromTablet,
    setNumPersonas,
    updateGuest,
    updateRelacion,
    confirmKnownGuest: () => goTo("confirmar_datos", "forward", 0),
    applyScannedData,
    setHoraLlegada: (v: string) =>
      dispatch({ type: "SET_HORA_LLEGADA", value: v }),
    setObservaciones: (v: string) =>
      dispatch({ type: "SET_OBSERVACIONES", value: v }),
    nextGuest,
    setRgpdAcepted: (v: boolean) => dispatch({ type: "SET_RGPD", value: v }),
  };

  return [state, nav, checkinActions, isLoading] as const;
}
