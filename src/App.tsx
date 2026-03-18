import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCheckin } from "@/hooks/useCheckin";
import { AppShell } from "@/layout/AppShell";
import { LoadingSpinner, Alert } from "@/components/ui";
import { useEffect, useRef, useState } from "react";

// --- IMPORTACIÓN DE TODAS TUS PANTALLAS ---
import { ScreenTabletBuscar } from "@/screens/ScreenTabletBuscar";
import { ScreenCheckinInicio } from "@/screens/ScreenCheckinInicio"; // Tu nueva pantalla legal
import { ScreenNumPersonas } from "@/screens/ScreenNumPersonas";
import { ScreenEscanear } from "@/screens/ScreenEscanear";
import { ScreenConfirmarDatos } from "@/screens/ScreenConfirmardatos";
import { ScreenRelacionesMenor } from "@/screens/ScreenRelacionesMenor";
import {
  ScreenFormPersonal,
  ScreenFormContacto,
  ScreenFormDocumento,
} from "@/screens/ScreenForms";
import {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from "@/screens/ScreenExtrasRevisionExito";

import type { Reserva, StepId } from "@/types";

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);
const TABLET_TIMEOUT_MS = 5 * 60 * 1000;

function RedirectToBienvenida() {
  const { token } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/checkin/${token}/bienvenida`, { replace: true });
  }, [navigate, token]);
  return null;
}

function RedirectToDefault() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/checkin/new/bienvenida", { replace: true });
  }, [navigate]);
  return null;
}

function CheckinWizard() {
  const { token, step } = useParams();
  const [state, nav, actions, isLoading] = useCheckin(token, step);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setIsOffline(false);
    const off = () => setIsOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const tabletTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(() => {
    if (state.appMode !== "tablet") return;
    const reset = () => {
      clearTimeout(tabletTimeoutRef.current);
      tabletTimeoutRef.current = setTimeout(() => {
        sessionStorage.removeItem(`state_${token}`);
        sessionStorage.removeItem(`history_${token}`);
        sessionStorage.removeItem(`allowedSteps_${token}`);
        sessionStorage.removeItem(`modoFlujo_${token}`);
        window.location.replace(`/checkin/${token}/tablet_buscar`);
      }, TABLET_TIMEOUT_MS);
    };
    reset();
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      clearTimeout(tabletTimeoutRef.current);
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, [state.appMode, token]);

  if (isLoading) {
    return (
      <div
        className="shell"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <LoadingSpinner text="Recuperando su reserva de forma segura…" />
      </div>
    );
  }

  const {
    goTo,
    goBack,
    goToDotIndex,
    setReservaFromTablet,
    setNumPersonas,
    updateGuest,
    updateRelacion,
    applyScannedData,
    setHoraLlegada,
    setObservaciones,
    nextGuest,
    setRgpdAcepted,
  } = actions;

  const currentStep = nav.step || "bienvenida";
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};
  const totalGuests = state.numAdultos + state.numMenores;

  const handleSubmit = async (): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserva: state.reserva,
          guests: state.guests.map((guest) => {
            const copia = { ...guest };
            delete copia.docFile;
            return copia;
          }),
          horaLlegada: state.horaLlegada,
          observaciones: state.observaciones,
        }),
      });

      interface CheckinRes {
        success?: boolean;
        error?: string;
      }
      const data = (await res.json().catch(() => ({}))) as CheckinRes;

      if (!res.ok || data?.success === false) {
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      goTo("exito");
    } catch (err) {
      console.error("Error al enviar:", err);
      goTo("exito");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (currentStep === "tablet_buscar") {
    return (
      <div className="shell">
        <div className="card">
          <ScreenTabletBuscar onFound={(res) => setReservaFromTablet(res)} />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      nav={nav}
      actions={{ goBack, goToDotIndex, goTo }}
      showDots={showDots}
      reserva={state.reserva}
      onGoToRevision={() => goTo("revision", "back")}
    >
      {isOffline && (
        <div style={{ padding: "8px 24px 0" }}>
          <Alert variant="warm">
            Está sin conexión. El envío podría fallar.
          </Alert>
        </div>
      )}

      {/* --- STEP 1: INICIO LEGAL (Sustituye a Bienvenida antigua) --- */}
      {currentStep === "bienvenida" && (
        <ScreenCheckinInicio
          reserva={
            state.reserva ||
            ({
              id: "---",
              numHuespedes: 0,
              confirmacion: "---",
              habitacion: "---",
              fechaEntrada: "",
              fechaSalida: "",
              numNoches: 0,
            } as unknown as Reserva)
          }
          onNext={(hayMenores: boolean) => {
            sessionStorage.setItem(`modoFlujo_${token}`, "manual");
            if (hayMenores) {
              goTo("num_personas");
            } else {
              setNumPersonas(state.reserva?.numHuespedes || 1, 0);
              goTo("form_personal", "forward", 0);
            }
          }}
        />
      )}

      {/* --- STEP 2: NÚMERO DE PERSONAS (Si hay menores) --- */}
      {currentStep === "num_personas" && (
        <ScreenNumPersonas
          numAdultos={state.numAdultos}
          numMenores={state.numMenores}
          onChange={setNumPersonas}
          onNext={() => goTo("form_personal", "forward", 0)}
          totalFijo={state.reserva?.numHuespedes}
        />
      )}

      {/* --- STEP 3: ESCANEAR --- */}
      {currentStep === "escanear" && (
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data, nav.guestIndex);
            goTo("form_personal");
          }}
          onSkip={() => goTo("form_personal")}
        />
      )}

      {/* --- STEP 4: CONFIRMAR DATOS (Si es conocido) --- */}
      {currentStep === "confirmar_datos" && (
        <ScreenConfirmarDatos
          guest={currentGuest}
          onConfirm={() => goTo("form_contacto")}
          onEdit={() => goTo("form_personal")}
        />
      )}

      {/* --- STEP 5: FORMULARIO PERSONAL --- */}
      {currentStep === "form_personal" && (
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={totalGuests}
          isMainGuest={isMainGuest}
          esMenor={!!currentGuest.esMenor}
          onNext={() => nextGuest(nav.guestIndex, "form_personal")}
        />
      )}

      {/* --- STEP 6: FORMULARIO CONTACTO --- */}
      {currentStep === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          onNext={() => nextGuest(nav.guestIndex, "form_contacto")}
        />
      )}

      {/* --- STEP 7: FORMULARIO DOCUMENTO --- */}
      {currentStep === "form_documento" && (
        <ScreenFormDocumento
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={totalGuests}
          isMainGuest={isMainGuest}
          onNext={() => nextGuest(nav.guestIndex, "form_documento")}
          modoFlujo={
            (sessionStorage.getItem(`modoFlujo_${token}`) as
              | "manual"
              | "escaneo") || "manual"
          }
        />
      )}

      {/* --- STEP 8: RELACIONES (Solo para menores) --- */}
      {currentStep === "form_relaciones" &&
        (() => {
          const menorRelIdx = nav.guestIndex - state.numAdultos;
          const adultos = state.guests.slice(0, state.numAdultos);
          return (
            <ScreenRelacionesMenor
              menor={currentGuest}
              menorIndex={menorRelIdx}
              menorRealIndex={nav.guestIndex}
              adultos={adultos}
              onRelacionChange={(aIdx: number, p: string) =>
                updateRelacion(menorRelIdx, aIdx, p)
              }
              onNext={() => nextGuest(nav.guestIndex, "form_relaciones")}
            />
          );
        })()}

      {/* --- STEP 9: EXTRAS --- */}
      {currentStep === "form_extras" && (
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={setHoraLlegada}
          onObsChange={setObservaciones}
          onNext={() => goTo("revision")}
        />
      )}

      {/* --- STEP 10: REVISIÓN --- */}
      {currentStep === "revision" && (
        <>
          {submitError && (
            <div style={{ padding: "8px 24px 0" }}>
              <Alert variant="err">{submitError}</Alert>
            </div>
          )}
          <ScreenRevision
            state={state}
            isSubmitting={isSubmitting}
            onEditStep={(targetStep) => goTo(targetStep as StepId, "back")}
            onSubmit={handleSubmit}
            onRgpdChange={setRgpdAcepted}
          />
        </>
      )}

      {/* --- STEP 11: ÉXITO --- */}
      {currentStep === "exito" && (
        <ScreenExito
          state={state}
          onAddHora={() => goTo("form_extras", "back")}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/checkin/:token" element={<RedirectToBienvenida />} />
        <Route
          path="/checkin/:token/:step"
          element={
            <ErrorBoundary>
              <CheckinWizard />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<RedirectToDefault />} />
      </Routes>
    </BrowserRouter>
  );
}
