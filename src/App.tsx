import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useNavigate,
  Navigate,
} from "react-router-dom";
import "./App.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCheckin } from "@/hooks/useCheckin";
import { AppShell } from "@/layout/AppShell";
import { LoadingSpinner, Alert } from "@/components/ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// --- PANTALLAS ---
import { ScreenTabletBuscar } from "@/screens/ScreenTabletBuscar";
import { ScreenBienvenida } from "@/screens/ScreenBienvenida";
import { ScreenCheckinInicio } from "@/screens/ScreenCheckinInicio";
import { ScreenNumPersonas } from "@/screens/ScreenNumPersonas";
import { ScreenEscanear } from "@/screens/ScreenEscanear";
import { ScreenConfirmarDatos } from "@/screens/ScreenConfirmardatos";
import { ScreenRelacionesMenor } from "@/screens/ScreenRelacionesMenor";
import { ScreenFormPersonal, ScreenFormContacto } from "@/screens/ScreenForms";
import {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from "@/screens/ScreenExtrasRevisionExito";

import type { StepId, PartialGuestData } from "@/types";

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);

function RedirectToNew() {
  return <Navigate to="/checkin/new/inicio" replace />;
}

function RedirectToBienvenida() {
  const { token } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/checkin/${token}/inicio`, { replace: true });
  }, [navigate, token]);
  return null;
}

function CheckinWizard() {
  const { t } = useTranslation();
  const { token, step } = useParams();
  const [state, nav, actions, isLoading] = useCheckin(token, step);
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isPartialSuccess, setIsPartialSuccess] = useState(false);

  // ✅ CAMBIO 1: Quitamos los useState/useEffect antiguos.
  // Ahora sacamos estas variables directamente del estado centralizado.
  const { hasMinorsFlag } = state;

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

  const isActuallyLoading =
    isLoading && token !== "new" && nav.step !== "tablet_buscar";

  if (isActuallyLoading) {
    return (
      <div
        className="shell"
        style={{ alignItems: "center", justifyContent: "center" }}
      >
        <LoadingSpinner text={t("common.loading")} />
      </div>
    );
  }

  // ✅ CAMBIO 2: Añadimos las dos nuevas funciones a las acciones que extraemos
  const {
    goTo,
    goBack,
    goToDotIndex,
    setNumPersonas,
    updateGuest,
    updateRelacion,
    nextGuest,
    setRgpdAcepted,
    setLegalPassed,
    setHasMinorsFlag,
  } = actions;

  const currentStep = nav.step || "inicio";
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  const customNav = { ...nav, canGoBack: nav.canGoBack };

  const handleSmartGoBack = () => {
    goBack();
  };

  const handleChooseMethod = (method: "scan" | "manual") => {
    sessionStorage.setItem(`modoFlujo_${token}`, method);
    if (hasMinorsFlag) {
      goTo("num_personas", "forward", 0);
    } else {
      setNumPersonas(state.reserva?.numHuespedes || 1);
      if (method === "scan") goTo("escanear", "forward", 0);
      else if (state.knownGuest) goTo("confirmar_datos", "forward", 0);
      else goTo("form_personal", "forward", 0);
    }
  };

  const submitToServer = async (isPartial: boolean): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const payload = {
        ...state, // ✅ Esto ahora enviará TODO (incluyendo legalPassed y hasMinorsFlag)
        guests: state.guests.map(({ docFile, ...rest }) => rest),
        isPartial,
      };

      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      setIsPartialSuccess(isPartial);

      if (!isPartial) {
        const keysToClear = [
          `state_${token}`,
          `history_${token}`,
          `allowedSteps_${token}`,
          `legalPassed_${token}`,
          `hasMinors_${token}`,
          `modoFlujo_${token}`,
        ];
        keysToClear.forEach((key) => sessionStorage.removeItem(key));
        goTo("exito", "forward");
      }
    } catch (err: unknown) {
      const errMsg =
        err instanceof Error ? err.message : t("errorBoundary.title");
      setSubmitError(errMsg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => submitToServer(false);
  const handlePartialSubmit = () => submitToServer(true);

  const adultosConIndice = state.guests
    .map((g, i) => ({ ...g, originalIndex: i }))
    .filter((g) => !g.esMenor);

  if (currentStep === "tablet_buscar") {
    return (
      <div className="shell">
        <div className="card">
          <ScreenTabletBuscar
            onFound={(res) => actions.setReservaFromTablet(res)}
          />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      nav={customNav}
      actions={{ goBack: handleSmartGoBack, goToDotIndex, goTo }}
      showDots={showDots}
      reserva={state.reserva}
      onGoToRevision={() => goTo("revision", "back")}
    >
      {isOffline && (
        <div style={{ padding: "8px 24px 0" }}>
          <Alert variant="warm">{t("search.error_connection")}</Alert>
        </div>
      )}

      {currentStep === "inicio" && (
        <ScreenCheckinInicio
          reserva={state.reserva as any}
          onNext={(hayMenores: boolean) => {
            // ✅ CAMBIO 3: Usamos las acciones que definimos arriba
            setHasMinorsFlag(hayMenores);
            setLegalPassed(true);
            goTo("bienvenida", "forward");
          }}
        />
      )}

      {currentStep === "bienvenida" && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => handleChooseMethod("scan")}
          onChooseManual={() => handleChooseMethod("manual")}
        />
      )}

      {currentStep === "num_personas" && (
        <ScreenNumPersonas
          numPersonas={state.numPersonas}
          onChange={setNumPersonas}
          onNext={() => {
            const flujo = sessionStorage.getItem(`modoFlujo_${token}`);
            if (flujo === "scan") goTo("escanear", "forward", 0);
            else if (state.knownGuest) goTo("confirmar_datos", "forward", 0);
            else goTo("form_personal", "forward", 0);
          }}
          totalFijo={state.reserva?.numHuespedes}
        />
      )}

      {currentStep === "escanear" && (
        <ScreenEscanear
          onScanned={(data) => {
            actions.applyScannedData(data, nav.guestIndex);
            goTo("form_personal", "forward");
          }}
          onSkip={() => goTo("form_personal", "forward")}
        />
      )}

      {currentStep === "confirmar_datos" && (
        <ScreenConfirmarDatos
          guest={currentGuest}
          onConfirm={() => goTo("form_contacto", "forward")}
          onEdit={() => goTo("form_personal", "forward")}
        />
      )}

      {currentStep === "form_personal" && (
        <ScreenFormPersonal
          data={currentGuest}
          allGuests={state.guests}
          onChange={(k: keyof PartialGuestData, v: any) =>
            updateGuest(nav.guestIndex, k, v)
          }
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          esMenor={!!currentGuest.esMenor}
          onNext={() => nextGuest(nav.guestIndex, "form_personal")}
          isSubmitting={isSubmitting}
          token={token || "new"}
          onPartialSave={
            handlePartialSubmit
          } /* ✅ CAMBIO 4: Pasamos la función al componente */
        />
      )}

      {currentStep === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(k: keyof PartialGuestData, v: any) =>
            updateGuest(nav.guestIndex, k, v)
          }
          onNext={() => nextGuest(nav.guestIndex, "form_contacto")}
          onPartialSave={handlePartialSubmit}
          hasNextGuest={state.numPersonas > 1}
          isSubmitting={isSubmitting}
          token={token || "new"}
        />
      )}

      {currentStep === "form_relaciones" && (
        <ScreenRelacionesMenor
          menor={currentGuest}
          adultos={adultosConIndice}
          onRelacionChange={(aIdx, p) =>
            updateRelacion(nav.guestIndex, aIdx, p)
          }
          onNext={() => nextGuest(nav.guestIndex, "form_relaciones")}
          onPartialSave={handlePartialSubmit}
          hasNextMinor={
            state.guests.findIndex((g, i) => i > nav.guestIndex && g.esMenor) >=
            0
          }
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === "form_extras" && (
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={actions.setHoraLlegada}
          onObsChange={actions.setObservaciones}
          onNext={() => goTo("revision", "forward")}
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
            onEditStep={(targetStep, gIdx) =>
              goTo(targetStep as StepId, "back", gIdx)
            }
            onSubmit={handleSubmit}
            onRgpdChange={setRgpdAcepted}
          />
        </>
      )}

      {currentStep === "exito" && (
        <ScreenExito
          state={state}
          onAddHora={() => goTo("form_extras", "back")}
          isPartial={isPartialSuccess}
        />
      )}
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/tablet_buscar"
          element={<Navigate to="/checkin/kiosko/tablet_buscar" replace />}
        />
        <Route path="/checkin/:token" element={<RedirectToBienvenida />} />
        <Route
          path="/checkin/:token/:step"
          element={
            <ErrorBoundary>
              <CheckinWizard />
            </ErrorBoundary>
          }
        />
        <Route path="*" element={<RedirectToNew />} />
      </Routes>
    </BrowserRouter>
  );
}
