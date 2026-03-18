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
  return Array.from(
    { length: total },
    (_, i) => prev[i] || { esMenor: false, relacionesConAdultos: [] },
  );
}

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
      const updated = { ...guests[action.index], [action.key]: action.value };
      if (action.key === "fechaNac" && typeof action.value === "string") {
        const parsed = dayjs(action.value);
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
        if (idx >= 0) rels[idx].parentesco = action.parentesco;
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
    case "RESET":
      return buildEmptyState(state.appMode);
    default:
      return state;
  }
}

export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();
  const token = tokenUrl || "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  const [state, setState] = useState<CheckinState>(() => {
    try {
      const stored = sessionStorage.getItem(`state_${token}`);
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn(err);
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
      console.warn(err);
    }
    return [];
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    try {
      const st = sessionStorage.getItem(`allowedSteps_${token}`);
      if (st) return new Set(JSON.parse(st));
    } catch (err) {
      console.warn(err);
    }
    return new Set(["bienvenida", "tablet_buscar"]);
  });

  const [isLoading, setIsLoading] = useState(token !== "new");
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");

  const dispatch = useCallback(
    (action: CheckinAction) => setState((prev) => checkinReducer(prev, action)),
    [],
  );

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
    if (token === "new") {
      setIsLoading(false);
      return;
    }
    async function load() {
      try {
        const res = await fetch(`/api/checkin/${token}`);
        const data = await res.json();
        if (data.data) dispatch({ type: "SET_KNOWN_GUEST", guest: data.data });
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [token, dispatch]);

  const actualStep =
    (stepUrl as StepId) ||
    (initialMode === "tablet" ? "tablet_buscar" : "bienvenida");
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

  const dotSteps = state.appMode === "link" ? FLOW_STEPS_LINK : DOT_STEPS_BASE;

  // 🔥 Aislamos el dotIndex para que todo el mundo pueda leerlo
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

  const actions = {
    goTo,
    goBack: () => {
      if (history.length > 1) {
        const p = history[history.length - 2];
        goTo(p.step, "back", p.guestIndex);
      }
    },

    goToDotIndex: (idx: number) => {
      if (idx < 0 || idx >= dotSteps.length) return;
      const targetStep = dotSteps[idx];
      const isBack = idx < currentDotIndex;
      goTo(targetStep, isBack ? "back" : "forward", activeGuestIndex);
    },

    setReservaFromTablet: (res: Reserva) => {
      dispatch({ type: "SET_RESERVA_TABLET", reserva: res });
      goTo("bienvenida");
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
    applyScannedData: (data: Partial<GuestData>, idx?: number) =>
      dispatch({ type: "APPLY_SCAN", data, guestIdx: idx ?? activeGuestIndex }),
    setHoraLlegada: (v: string) =>
      dispatch({ type: "SET_HORA_LLEGADA", value: v }),
    setObservaciones: (v: string) =>
      dispatch({ type: "SET_OBSERVACIONES", value: v }),
    nextGuest: (currIdx: number, from: StepId) => {
      if (from === "form_personal") {
        if (currIdx === 0) goTo("form_contacto", "forward", 0);
        else if (currIdx + 1 < state.numPersonas)
          goTo("form_personal", "forward", currIdx + 1);
        else {
          const mIdx = state.guests.findIndex((g) => g.esMenor);
          if (mIdx >= 0) goTo("form_relaciones", "forward", mIdx);
          else goTo("form_extras");
        }
      } else if (from === "form_contacto") {
        if (state.numPersonas > 1) goTo("form_personal", "forward", 1);
        else goTo("form_extras");
      } else if (from === "form_relaciones") {
        const nextM = state.guests.findIndex(
          (g, i) => i > currIdx && g.esMenor,
        );
        if (nextM >= 0) goTo("form_relaciones", "forward", nextM);
        else goTo("form_extras");
      }
    },
    setRgpdAcepted: (v: boolean) => dispatch({ type: "SET_RGPD", value: v }),
  };

  return [state, nav, actions, isLoading] as const;
}
