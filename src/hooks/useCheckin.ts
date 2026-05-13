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
import { FLOW_STEPS } from "@/constants";
import { loadCheckinData } from "@/api/checkin.service";
import { getCurrentTokenPayload } from "@/api/auth.service";
import { getStoredAccessCode, clearToken, isStaffLoggedIn } from "@/api/axiosInstance";

/** Lee ?guestIndex=N del URL actual. Devuelve N si N > 0, o null. */
function getCompanionGuestIndexFromUrl(): number | null {
  if (typeof window === "undefined") return null;
  const p = new URLSearchParams(window.location.search).get("guestIndex");
  const n = p ? parseInt(p, 10) : 0;
  return n > 0 ? n : null;
}
// ── Lista de pasos válidos ───────────────────────────────────────────────────
const VALID_STEPS: ReadonlyArray<StepId> = [
  "tablet_buscar",
  "inicio",
  "bienvenida",
  "escanear",
  "form_personal",
  "form_contacto",
  "form_relaciones",
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
    knownGuest?: GuestData | null; // <--- Nuevo
    companions?: GuestData[];      // <--- Nuevo
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
}else {
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
    bookingId: null,
    clientId: null,
    knownGuest: null,
    numAdultos: 1,
    numMenores: 0,
    numPersonas: 1,
    guests: [emptyGuest()],
    horaLlegada: "",
    observaciones: "",
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
    case "SET_KNOWN_GUEST": {
      const existing = state.guests[0] ?? {};
      const hasData = !!(existing.nombre?.trim() || existing.numDoc?.trim());
      return {
        ...state,
        knownGuest: action.guest,
        guests: hasData ? state.guests : [{ ...action.guest, esMenor: false }],
        clientId: action.guest.id || state.clientId,
      };
    }

    // BUSCA EL CASE "SET_RESERVA_TABLET" Y REEMPLÁZALO COMPLETAMENTE:
case "SET_RESERVA_TABLET": {
  const mainGuest = action.knownGuest 
    ? { ...action.knownGuest, esMenor: false } 
    : emptyGuest();
    
  const allGuests = [mainGuest, ...(action.companions || [])];

  return {
    ...state,
    reserva: action.reserva,
    bookingId: action.bookingId,
    clientId: action.clientId,
    knownGuest: action.knownGuest || null,
    numPersonas: action.reserva.numHuespedes,
    guests: mergeGuests(allGuests, action.reserva.numHuespedes),
    numAdultos: allGuests.filter((g) => !g.esMenor).length,
    numMenores: allGuests.filter((g) => g.esMenor).length,
  };
}

    case "SET_RESERVA":
      return {
        ...state,
        reserva: action.reserva,
        bookingId: action.bookingId,
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
    const FREE_TEXT_FIELDS: (keyof PartialGuestData)[] = [
        "direccion", "email", "telefono", "ciudad", "provincia",
        "cp", "observations", "numDoc", "soporteDoc",
      ];
      if (typeof finalValue === "string" && !FREE_TEXT_FIELDS.includes(action.key)) {
        finalValue = finalValue.replace(/\s+/g, " ").trim();
      }
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

        const CODIGOS_CONVIVENCIA = new Set(["PM", "TU"]);
        if (CODIGOS_CONVIVENCIA.has(action.parentesco)) {
          const adulto = guests[action.adultoIndex];
          if (adulto && !adulto.esMenor) {
            const yaTieneDireccion = !!(
              menor.direccion?.trim() || menor.ciudad?.trim()
            );
            if (!yaTieneDireccion && adulto.direccion) {
              menor.direccion = adulto.direccion;
              menor.ciudad = adulto.ciudad ?? "";
              menor.codCity = adulto.codCity ?? "";
              menor.provincia = adulto.provincia ?? "";
              menor.cp = adulto.cp ?? "";
              menor.pais = adulto.pais ?? "ES";
            }
          }
        }
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
        // Si viene de enlace compartido, usar el guestIndex del URL
        const urlGuestIdx = getCompanionGuestIndexFromUrl() ?? 0;
        return [
          ...storedHistory,
          { step: stepUrl as StepId, guestIndex: urlGuestIdx },
        ];
      }
    }
    return storedHistory;
  });

  const [allowedSteps, setAllowedSteps] = useState<Set<StepId>>(() => {
    let validStored: StepId[] = ["inicio", "tablet_buscar", "revision"];
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
  // Índice de huésped que este dispositivo debe rellenar (viene de ?guestIndex=N)
  const companionGuestIndexRef = useRef<number | null>(
    getCompanionGuestIndexFromUrl(),
  );
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
    if (token === "new" && !state.reserva) return;

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

    
  
const isNumericToken = /^\d+$/.test(token);
const kioskoBookingId = isNumericToken && isStaffLoggedIn()
  ? parseInt(token, 10)
  : NaN;

    let cancelled = false;

    async function load() {
      let bookingIdToLoad: number | null = null;
      const isKioskoRoute =
        !Number.isNaN(kioskoBookingId) && kioskoBookingId > 0;

      if (isKioskoRoute) {
        bookingIdToLoad = kioskoBookingId;
      } else {
        const payload = getCurrentTokenPayload();
        if (!payload) {
          if (!cancelled) setIsLoading(false);
          return;
        }
        const storedCode = getStoredAccessCode();
        if (storedCode && storedCode !== token) {
          clearToken();
          if (!cancelled) setIsLoading(false);
          return;
        }
        bookingIdToLoad = payload.booking_id;
      }

      try {
        const result = await loadCheckinData(bookingIdToLoad);
        if (cancelled) return;

        if (isKioskoRoute) {
          dispatch({
            type: "SET_RESERVA_TABLET",
            reserva: result.reserva,
            bookingId: result.bookingId,
            clientId: result.clientId,
            knownGuest: result.knownGuest,
            companions: result.companions,
          });
        } else {
          dispatch({
            type: "SET_RESERVA",
            reserva: result.reserva,
            bookingId: result.bookingId,
            clientId: result.clientId,
          });

          if (result.knownGuest) {
            dispatch({ type: "SET_KNOWN_GUEST", guest: result.knownGuest });
          }
          if (result.companions.length > 0) {
            dispatch({
              type: "SET_COMPANIONS_LOADED",
              companions: result.companions,
            });
          }
          dispatch({
            type: "SET_NUM_PERSONAS",
            total: result.reserva.numHuespedes,
          });
        }

        // ── Dispositivo compañero ─────────────────────────────────────────────
        const companionIdx = companionGuestIndexRef.current;
        if (
          companionIdx !== null &&
          result.knownGuest?.id &&
          companionIdx < result.reserva.numHuespedes &&
          stepUrl !== "bienvenida"
        ) {
          const newHistory: HistoryEntry[] = [
            { step: "bienvenida", guestIndex: companionIdx },
          ];
          localStorage.setItem(
            `history_${token}`,
            JSON.stringify({ data: newHistory, timestamp: Date.now() }),
          );
          localStorage.setItem(
            `allowedSteps_${token}`,
            JSON.stringify({
              data: ["inicio", "bienvenida", "tablet_buscar"],
              timestamp: Date.now(),
            }),
          );
          setAppHistory(newHistory);
          setAllowedSteps(
            new Set<StepId>(["inicio", "bienvenida", "tablet_buscar"]),
          );
          navigateRef.current(
            `/checkin/${token}/bienvenida?guestIndex=${companionIdx}`,
            { replace: true },
          );
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
  }, [token, dispatch, stepUrl]);
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

    const yaAcepto = sessionStorage.getItem(`legalPassed_${token}`) === "true";

    if (yaAcepto) {
      if (appHistory.length > 0) {
        return appHistory[appHistory.length - 1].step;
      }
      return "bienvenida";
    }

    return "inicio";
  })();

 const activeGuestIndex = (() => {
    const last = appHistory[appHistory.length - 1];
    if (last && last.step === actualStep) return last.guestIndex;
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

      // exito = paso terminal: limpiamos history y reemplazamos la URL
      // para que el back del navegador no lleve a revision/form_*.
      const isTerminal = nextStep === "exito";
      const guestIdx = gIdx ?? activeGuestIndexRef.current;

      if (isTerminal) {
        setAppHistory([{ step: nextStep, guestIndex: guestIdx }]);
        navigate(`/checkin/${token}/${nextStep}`, { replace: true });
    } else {
        setAppHistory((prev) => [
          ...prev.filter((h) => !(h.step === nextStep && dir === "forward")),
          { step: nextStep, guestIndex: guestIdx },
        ]);
        if (dir === "forward") navigate(`/checkin/${token}/${nextStep}`);
        else navigate(`/checkin/${token}/${nextStep}`, { replace: true });
      }
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

      const goToNextMinorRelaciones = (startIdx: number) => {
        const nextM = guests.findIndex((g, i) => i > startIdx && g.esMenor);
        if (nextM >= 0) return goTo("form_relaciones", "forward", nextM);
        return goTo("form_extras", "forward", 0);
      };
      // Dispositivo compañero: al terminar su propio huésped va a extras,
      // no intenta rellenar el siguiente (que es de otro dispositivo)
      if (
        from === "form_contacto" &&
        companionGuestIndexRef.current !== null &&
        currIdx === companionGuestIndexRef.current &&
        !guests[currIdx]?.esMenor
      ) {
        return goTo("form_extras", "forward", 0);
      }

      if (from === "huesped_intermedio") {
        return goTo("bienvenida", "forward", currIdx + 1);
      }

      if (from === "form_personal") {
        const esMenor = guests[currIdx].esMenor;

        if (esMenor) {
          if (currIdx + 1 < numPersonas) {
            return goTo("bienvenida", "forward", currIdx + 1);
          }
          return goToFirstMinorOrExtras();
        }

        return goTo("form_contacto", "forward", currIdx);
      }

      if (from === "form_contacto") {
        const esMenor = guests[currIdx].esMenor;

        if (esMenor) {
          return goToNextMinorRelaciones(currIdx);
        }

        if (currIdx + 1 < numPersonas) {
          return goTo("huesped_intermedio", "forward", currIdx);
        }
        return goToFirstMinorOrExtras();
      }

      if (from === "form_relaciones") {
        const minor = guests[currIdx];
        const tieneDireccion = !!(
          minor.direccion?.trim() ||
          minor.ciudad?.trim() ||
          minor.cp?.trim()
        );

        if (!tieneDireccion) {
          return goTo("form_contacto", "forward", currIdx);
        }

        return goToNextMinorRelaciones(currIdx);
      }
    },
    [goTo],
  );

  const dotSteps = useMemo(() => {
    return modoFlujo === "manual"
      ? FLOW_STEPS.filter((s) => s !== "escanear")
      : FLOW_STEPS;
  }, [modoFlujo]);

  const canGoBack =
    appHistory.length > 0 &&
    !["exito", "tablet_buscar", "inicio"].includes(actualStep);

  let currentDotIndex = dotSteps.indexOf(actualStep);
  if (actualStep === "form_relaciones")
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
      setReservaFromTablet: async (_res: Reserva, bId: number, clientId: number | null) => {
        void clientId;
        try {
          const result = await loadCheckinData(bId);

          dispatch({
            type: "SET_RESERVA_TABLET",
            reserva: result.reserva,
            bookingId: result.bookingId,
            clientId: result.clientId,
            knownGuest: result.knownGuest,
            companions: result.companions,
          });

          setAppHistory([{ step: "bienvenida", guestIndex: 0 }]);
          setAllowedSteps(new Set(["bienvenida", "tablet_buscar", "inicio"]));
          goTo("bienvenida", "forward", 0);
        } catch (e) {
          console.error("Error al cargar datos completos en modo tablet:", e);
        }
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
