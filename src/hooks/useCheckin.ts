import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import type {
  CheckinState,
  AppMode,
  Reserva,
  PartialGuestData,
  GuestData,
  StepId,
  CheckinNav,
  NavDirection,
  CheckinActions,
} from "@/types";
import { FLOW_STEPS_LINK, DOT_STEPS_BASE } from "@/constants";
import { loadCheckinData } from "@/api/checkin.service";
import { loginMagicLink } from "@/api/auth.service";
import { splitSurnames } from "@/utils/surnames";

// ── Lista de pasos válidos ───────────────────────────────────────────────────
const VALID_STEPS: ReadonlyArray<StepId> = [
  "tablet_buscar",
  "inicio",
  "bienvenida",
  "confirmar_datos",
  "escanear",
  "form_personal",
  "form_contacto",
  "form_documento",
  "form_relaciones",
  "num_personas",
  "form_extras",
  "revision",
  "exito",
];

// ── Tipos Internos ───────────────────────────────────────────────────────────
interface HistoryEntry {
  step: StepId;
  guestIndex: number;
}

type CheckinAction =
  | { type: "SET_KNOWN_GUEST"; guest: GuestData }
  | {
      type: "SET_RESERVA_TABLET";
      reserva: Reserva;
      bookingId: number;
      clientId: number | null;
    }
  | {
      type: "SET_RESERVA";
      reserva: Reserva;
      bookingId: number;
      clientId: number | null;
    }
  | { type: "SET_NUM_PERSONAS"; total: number }
  | { type: "SET_GUESTS"; guests: PartialGuestData[] }
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
  | { type: "SET_COMPANIONS_LOADED"; companions: GuestData[] }
  | { type: "RESET" };

// ── Helpers de Persistencia ──────────────────────────────────────────────────

function getInitialState(token: string, mode: AppMode): CheckinState {
  const sessionKey = `state_${token}`;

  try {
    sessionStorage.removeItem(`h_ckin_data_${token}`);
    sessionStorage.removeItem("lumina_enc_key");
  } catch (e) {
    console.warn(e);
  }

  try {
    const raw = localStorage.getItem(sessionKey);
    if (raw) {
      const storedData = JSON.parse(raw);
      const { timestamp, state } = storedData;
      if (Date.now() - timestamp < 30 * 60 * 1000) {
        return state;
      } else {
        localStorage.removeItem(sessionKey);
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) console.warn("[useCheckin] getInitialState:", e);
  }

  return buildEmptyState(mode);
}

function emptyGuest(): PartialGuestData {
  return { esMenor: false, relacionesConAdultos: [], pais: "ES" };
}

export function buildEmptyState(appMode: AppMode): CheckinState {
  return {
    appMode,
    reserva: null,
    bookingId: null, // 👈 IDs integrados en el estado
    clientId: null,
    knownGuest: null,
    numAdultos: 1,
    numMenores: 0,
    numPersonas: 1,
    guests: [emptyGuest()],
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
  return Array.from({ length: total }, (_, i) => prev[i] ?? emptyGuest());
}

// ── Reducer ──────────────────────────────────────────────────────────────────
export function checkinReducer(
  state: CheckinState,
  action: CheckinAction,
): CheckinState {
  switch (action.type) {
    case "SET_GUESTS":
      return { ...state, guests: action.guests };
    case "SET_KNOWN_GUEST":
      return {
        ...state,
        knownGuest: action.guest,
        guests: [{ ...action.guest, esMenor: false }],
        clientId: action.guest.id || state.clientId,
      };

    case "SET_RESERVA_TABLET":
      return {
        ...state,
        reserva: action.reserva,
        bookingId: action.bookingId, // 👈 Persistimos el ID en tablet
        clientId: action.clientId,
        numPersonas: action.reserva.numHuespedes,
        numAdultos: action.reserva.numHuespedes,
        numMenores: 0,
        guests: mergeGuests([], action.reserva.numHuespedes),
      };

    case "SET_RESERVA":
      return {
        ...state,
        reserva: action.reserva,
        bookingId: action.bookingId, // 👈 Persistimos el ID en link flow
        clientId: action.clientId,
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

    case "SET_COMPANIONS_LOADED": {
      const mainGuest = state.guests[0] ?? {
        esMenor: false,
        relacionesConAdultos: [],
      };

      const companionGuests = action.companions.map((c) => ({
        ...c,
        esMenor: c.fechaNac
          ? dayjs().diff(dayjs(c.fechaNac), "years") < 18
          : (c.esMenor ?? false),
        relacionesConAdultos: c.relacionesConAdultos ?? [],
      }));

      const allGuests = [mainGuest, ...companionGuests];
      const numMenores = allGuests.filter((g) => g.esMenor).length;
      const numAdultos = allGuests.filter((g) => !g.esMenor).length;

      return {
        ...state,
        guests: allGuests,
        numPersonas: Math.max(state.numPersonas, allGuests.length),
        numAdultos,
        numMenores,
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

// ── Hook Principal ───────────────────────────────────────────────────────────
export function useCheckin(tokenUrl?: string, stepUrl?: string) {
  const navigate = useNavigate();
  const token = tokenUrl ?? "new";
  const initialMode: AppMode = token === "new" ? "tablet" : "link";

  const [state, setState] = useState<CheckinState>(() =>
    getInitialState(token, initialMode),
  );

  const [appHistory, setAppHistory] = useState<HistoryEntry[]>(() => {
    let storedHistory: HistoryEntry[] = [];
    try {
      const raw = localStorage.getItem(`history_${token}`);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < 30 * 60 * 1000) storedHistory = data;
      }
    } catch (e) {
      console.warn("No se pudo cargar el historial", e);
    }

    if (stepUrl && VALID_STEPS.includes(stepUrl as StepId)) {
      const stepExists = storedHistory.some((h) => h.step === stepUrl);
      if (!stepExists) {
        return [...storedHistory, { step: stepUrl as StepId, guestIndex: 0 }];
      }
    }
    return storedHistory;
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    let validStored: StepId[] = ["inicio", "tablet_buscar"];
    try {
      const raw = localStorage.getItem(`allowedSteps_${token}`);
      if (raw) {
        const { data, timestamp } = JSON.parse(raw);
        if (Date.now() - timestamp < 30 * 60 * 1000) validStored = data;
      }
    } catch (e) {
      console.warn("No se pudieron cargar los pasos permitidos", e);
    }

    if (stepUrl && VALID_STEPS.includes(stepUrl as StepId)) {
      return new Set([...validStored, stepUrl as StepId]);
    }
    return new Set(validStored);
  });

  const [modoFlujo, setModoFlujo] = useState<"scan" | "manual" | null>(() => {
    const stored = localStorage.getItem(`modoFlujo_${token}`);
    return stored === "scan" || stored === "manual" ? stored : null;
  });

  useEffect(() => {
    if (modoFlujo) localStorage.setItem(`modoFlujo_${token}`, modoFlujo);
  }, [modoFlujo, token]);

  const [isLoading, setIsLoading] = useState(token !== "new");
  const [navDirection, setNavDirection] = useState<NavDirection>("forward");
  const [isNavigating, setIsNavigating] = useState(false);

  const stateRef = useRef(state);
  const isInternalNavRef = useRef(false);
  const navigateRef = useRef(navigate);
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeGuestIndexRef = useRef(0);

  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (token === "new" && !state.reserva) return; // No persistimos el estado vacío inicial en tablet

    const persistableState = {
      ...state,
      guests: state.guests.map((g) => ({ ...g, docFile: null })),
    };

    const dataToSave = JSON.stringify({
      state: persistableState,
      timestamp: Date.now(),
    });

    localStorage.setItem(`state_${token}`, dataToSave);
  }, [state, token]);

  useEffect(
    () =>
      localStorage.setItem(
        `history_${token}`,
        JSON.stringify({ data: appHistory, timestamp: Date.now() }),
      ),
    [appHistory, token],
  );

  useEffect(
    () =>
      localStorage.setItem(
        `allowedSteps_${token}`,
        JSON.stringify({
          data: Array.from(allowedSteps),
          timestamp: Date.now(),
        }),
      ),
    [allowedSteps, token],
  );

  const dispatch = useCallback(
    (action: CheckinAction) => setState((prev) => checkinReducer(prev, action)),
    [],
  );

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
            await loginMagicLink(token);
          } catch {
            if (cancelled) return;
            localStorage.removeItem(`h_ckin_data_${token}`);
            navigateRef.current("/invalid", { replace: true });
            return;
          }
        }

        const result = await loadCheckinData(token);
        if (cancelled) return;

        // 👇 IDs enviados al dispatch para que vivan en el state persistente
        dispatch({
          type: "SET_RESERVA",
          reserva: result.reserva,
          bookingId: result.bookingId,
          clientId: result.clientId,
        });

        const hasOwnData =
          stateRef.current.guests[0]?.nombre?.trim() ||
          stateRef.current.guests[0]?.numDoc?.trim();

        if (result.knownGuest && !hasOwnData) {
          dispatch({ type: "SET_KNOWN_GUEST", guest: result.knownGuest });
        }

        if (result.companions.length > 0) {
          dispatch({
            type: "SET_COMPANIONS_LOADED",
            companions: result.companions,
          });
        }
      } catch (e) {
        if (cancelled) return;
        console.warn(e);
        localStorage.removeItem(`h_ckin_data_${token}`);
        navigateRef.current("/invalid", { replace: true });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, dispatch]);

  useEffect(() => {
    return () => {
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, []);

  const requestedStep = stepUrl as StepId | undefined;

  const actualStep: StepId = (() => {
    if (requestedStep && VALID_STEPS.includes(requestedStep))
      return requestedStep;
    if (initialMode === "tablet") return "tablet_buscar";

    const yaAcepto =
      localStorage.getItem(`legalPassed_${token}`) === "true" ||
      state.legalPassed;
    if (yaAcepto) {
      let hist: HistoryEntry[] = [];
      try {
        const raw = localStorage.getItem(`history_${token}`);
        if (raw) hist = JSON.parse(raw).data || [];
      } catch (e) {
        console.warn("No se pudo leer la historia para actualStep", e);
      }

      if (hist.length > 0) return hist[hist.length - 1].step;
      return "bienvenida";
    }

    return "inicio";
  })();

  const activeGuestIndex = (() => {
    for (let i = appHistory.length - 1; i >= 0; i--) {
      if (appHistory[i].step === actualStep) return appHistory[i].guestIndex;
    }
    return 0;
  })();

  useEffect(() => {
    activeGuestIndexRef.current = activeGuestIndex;
  }, [activeGuestIndex]);

  const goTo = useCallback(
    (nextStep: StepId, dir: NavDirection = "forward", gIdx?: number) => {
      if (isNavigating) return;
      setIsNavigating(true);
      setAllowedSteps((prev) => new Set(prev).add(nextStep));
      isInternalNavRef.current = true;
      setNavDirection(dir);
      setAppHistory((prev) => [
        ...prev,
        { step: nextStep, guestIndex: gIdx ?? activeGuestIndexRef.current },
      ]);
      if (dir === "forward") navigate(`/checkin/${token}/${nextStep}`);
      else navigate(`/checkin/${token}/${nextStep}`, { replace: true });
      navTimerRef.current = setTimeout(() => setIsNavigating(false), 350);
    },
    [navigate, token, isNavigating],
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

      const goToFirstMinorOrExtras = () => {
        const nextM = guests.findIndex((g) => g.esMenor);
        if (nextM >= 0) return goTo("form_relaciones", "forward", nextM);
        return goTo("form_extras", "forward", 0);
      };

      if (from === "form_personal") {
        return goTo("form_contacto", "forward", currIdx);
      }

      if (from === "form_contacto") {
        if (currIdx + 1 < numPersonas) {
          return goTo("bienvenida", "forward", currIdx + 1);
        }
        return goToFirstMinorOrExtras();
      }

      if (from === "form_relaciones") {
        const nextM = guests.findIndex((g, i) => i > currIdx && g.esMenor);
        if (nextM >= 0) return goTo("form_relaciones", "forward", nextM);
        return goTo("form_extras", "forward", 0);
      }
    },
    [goTo],
  );

  const dotSteps = useMemo(() => {
    const base = state.appMode === "link" ? FLOW_STEPS_LINK : DOT_STEPS_BASE;
    return modoFlujo === "manual" ? base.filter((s) => s !== "escanear") : base;
  }, [state.appMode, modoFlujo]);

  const canGoBack =
    appHistory.length > 0 &&
    !["exito", "tablet_buscar", "inicio"].includes(actualStep);

  let currentDotIndex = dotSteps.indexOf(actualStep);
  if (["confirmar_datos", "form_relaciones"].includes(actualStep))
    currentDotIndex = dotSteps.indexOf("form_personal");

  const maxAllowedDotIndex = useMemo(() => {
    let maxIdx = 0;
    allowedSteps.forEach((step) => {
      const idx = dotSteps.indexOf(step as StepId);
      if (idx > maxIdx) maxIdx = idx;
    });
    return maxIdx;
  }, [allowedSteps, dotSteps]);

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
      maxAllowedDotIndex,
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
      maxAllowedDotIndex,
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
      // 👇 Actualizado para recibir y guardar IDs en tablet mode
      setReservaFromTablet: (res: Reserva, bId: number, cId: number | null) => {
        dispatch({
          type: "SET_RESERVA_TABLET",
          reserva: res,
          bookingId: bId,
          clientId: cId,
        });
        setAppHistory([{ step: "bienvenida", guestIndex: 0 }]);
        setAllowedSteps(new Set(["bienvenida", "tablet_buscar"]));
        goTo("bienvenida", "forward", 0);
      },
      setNumPersonas: (total) => dispatch({ type: "SET_NUM_PERSONAS", total }),
      setGuests: (guests) => dispatch({ type: "SET_GUESTS", guests }),
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
          guestIdx: idx ?? activeGuestIndexRef.current,
        }),
      setHoraLlegada: (v) => dispatch({ type: "SET_HORA_LLEGADA", value: v }),
      setObservaciones: (v) =>
        dispatch({ type: "SET_OBSERVACIONES", value: v }),
      nextGuest,
      setRgpdAcepted: (v) => dispatch({ type: "SET_RGPD", value: v }),
      setLegalPassed: (v) => {
        dispatch({ type: "SET_LEGAL_PASSED", value: v });
        localStorage.setItem(`legalPassed_${token}`, String(v));
      },
      setHasMinorsFlag: (v) =>
        dispatch({ type: "SET_HAS_MINORS_FLAG", value: v }),
    }),
    [goTo, goBack, dispatch, dotSteps, currentDotIndex, nextGuest, token],
  );

  return [state, nav, actions, isLoading, setModoFlujo] as const;
}
