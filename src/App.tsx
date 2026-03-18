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

import { ScreenTabletBuscar } from "@/screens/ScreenTabletBuscar";
import { ScreenBienvenida } from "@/screens/ScreenBienvenida";
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

import type { StepId } from "@/types";

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

  const handleChooseManual = () => {
    sessionStorage.setItem(`modoFlujo_${token}`, "manual");
    if (state.knownGuest) {
      goTo("confirmar_datos");
    } else {
      goTo("num_personas");
    }
  };

  // En App.tsx, busca handleSubmit y cámbialo por esto:
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

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        // ignore
      }
      const parsed = data as { success?: boolean; error?: string } | null;
      if (!res.ok || parsed?.success === false) {
        throw new Error(parsed?.error ?? `HTTP ${res.status}`);
      }

      goTo("exito");
    } catch (err) {
      console.error("Error al enviar check-in:", err);
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
            Está sin conexión. Puede continuar rellenando datos, pero el envío
            podría fallar hasta recuperar Internet.
          </Alert>
        </div>
      )}

      {currentStep === "bienvenida" && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => {
            sessionStorage.setItem(`modoFlujo_${token}`, "escaneo");
            goTo("escanear");
          }}
          onChooseManual={handleChooseManual}
        />
      )}

      {currentStep === "num_personas" && (
        <ScreenNumPersonas
          numAdultos={state.numAdultos}
          numMenores={state.numMenores}
          onChange={setNumPersonas}
          onNext={() => goTo("form_personal", "forward", 0)}
          totalFijo={state.reserva?.numHuespedes}
        />
      )}

      {currentStep === "confirmar_datos" && (
        <ScreenConfirmarDatos
          guest={currentGuest}
          onConfirm={() => goTo("form_contacto")}
          onEdit={() => goTo("form_personal")}
        />
      )}

      {currentStep === "escanear" && (
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data, nav.guestIndex);
            goTo("num_personas");
          }}
          onSkip={() => goTo("num_personas")}
        />
      )}

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
      {currentStep === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          onNext={() => nextGuest(nav.guestIndex, "form_contacto")}
        />
      )}

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
              | "escaneo") || "escaneo"
          }
        />
      )}

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
              onRelacionChange={(adultoIndex: number, parentesco: string) =>
                updateRelacion(menorRelIdx, adultoIndex, parentesco)
              }
              onNext={() => nextGuest(nav.guestIndex, "form_relaciones")}
            />
          );
        })()}

      {currentStep === "form_extras" && (
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={setHoraLlegada}
          onObsChange={setObservaciones}
          onNext={() => goTo("revision")}
        />
      )}

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
