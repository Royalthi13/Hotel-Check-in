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

import type { Reserva, StepId, PartialGuestData } from "@/types";

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);

// FIX BUG MEDIUM #5: wildcard redirige a token "undefined"
// Antes: useParams() devolvía undefined para rutas sin :token → "/checkin/undefined/bienvenida"
// Ahora: redirige siempre a /checkin/new/bienvenida como fallback seguro
function RedirectToNew() {
  return <Navigate to="/tablet_buscar" replace />;
}

function RedirectToBienvenida() {
  const { token } = useParams();
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/checkin/${token}/bienvenida`, { replace: true });
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

  const [legalPassed, setLegalPassed] = useState(
    () => sessionStorage.getItem(`legalPassed_${token}`) === "true",
  );
  const [hasMinorsFlag, setHasMinorsFlag] = useState(
    () => sessionStorage.getItem(`hasMinors_${token}`) === "true",
  );

  useEffect(() => {
    sessionStorage.setItem(`legalPassed_${token}`, String(legalPassed));
  }, [legalPassed, token]);

  useEffect(() => {
    sessionStorage.setItem(`hasMinors_${token}`, String(hasMinorsFlag));
  }, [hasMinorsFlag, token]);

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

  const {
    goTo,
    goBack,
    goToDotIndex,
    setNumPersonas,
    updateGuest,
    updateRelacion,
    nextGuest,
    setRgpdAcepted,
  } = actions;

  const currentStep = nav.step || "bienvenida";
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  const customNav = {
    ...nav,
    canGoBack: nav.canGoBack || (currentStep === "bienvenida" && legalPassed),
  };

  const handleSmartGoBack = () => {
    if (currentStep === "bienvenida" && legalPassed) {
      setLegalPassed(false);
    } else {
      goBack();
    }
  };

  const handleChooseMethod = (method: "scan" | "manual") => {
    // FIX BUG HIGH #5: guardar modoFlujo CON token para que ScreenForms lo lea bien
    // (ver también fix en ScreenForms donde se lee con token)
    sessionStorage.setItem(`modoFlujo_${token}`, method);

    if (hasMinorsFlag) {
      goTo("num_personas", "forward", 0);
    } else {
      setNumPersonas(state.reserva?.numHuespedes || 1);
      if (method === "scan") {
        goTo("escanear", "forward", 0);
      } else if (state.knownGuest) {
        goTo("confirmar_datos", "forward", 0);
      } else {
        goTo("form_personal", "forward", 0);
      }
    }
  };

  // FIX BUG MEDIUM #2: handleSubmit no navega a "exito" en el catch
  // Antes: el catch hacía goTo("exito") → el usuario veía pantalla de éxito aunque fallara.
  // Ahora: en caso de error solo muestra el mensaje, no navega.
  const handleSubmit = async (): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserva: state.reserva,
          guests: state.guests.map((g) => {
            const copia = { ...g };
            delete copia.docFile; // El archivo no se envía en el JSON
            return copia;
          }),
          horaLlegada: state.horaLlegada,
          observaciones: state.observaciones,
          isPartial: false,
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

      // ✅ LIMPIEZA DE SESSION STORAGE (Severidad Baja)
      // Eliminamos todas las claves vinculadas a este token específico
      const keysToClear = [
        `state_${token}`,
        `history_${token}`,
        `allowedSteps_${token}`,
        `legalPassed_${token}`,
        `hasMinors_${token}`,
        `modoFlujo_${token}`
      ];
      keysToClear.forEach(key => sessionStorage.removeItem(key));

      setIsPartialSuccess(false);
      goTo("exito", "forward");
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : t("errorBoundary.title"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePartialSubmit = async (): Promise<void> => {
    setSubmitError("");
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reserva: state.reserva,
          guests: state.guests.map((g) => {
            const copia = { ...g };
            delete copia.docFile;
            return copia;
          }),
          isPartial: true,
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
      setIsPartialSuccess(true);
      goTo("exito", "forward");
    } catch (err: unknown) {
      // FIX: ya no hacemos goTo("exito") en el catch
      setSubmitError(
        err instanceof Error ? err.message : t("errorBoundary.title"),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // FIX BUG HIGH #3: adultosConIndice — los índices son del array global de guests
  // Esto es correcto: originalIndex = índice real en state.guests
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

      {currentStep === "bienvenida" && !legalPassed && (
        <ScreenCheckinInicio
          reserva={
            state.reserva ||
            ({
              confirmacion: "---",
              habitacion: "---",
              fechaEntrada: "",
              fechaSalida: "",
              numHuespedes: 1,
              numNoches: 0,
            } as unknown as Reserva)
          }
          onNext={(hayMenores: boolean) => {
            setHasMinorsFlag(hayMenores);
            setLegalPassed(true);
          }}
        />
      )}

      {currentStep === "bienvenida" && legalPassed && (
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
            // FIX BUG HIGH #5: leer modoFlujo CON token
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
          onChange={(k: keyof PartialGuestData, v: unknown) =>
            updateGuest(nav.guestIndex, k, v)
          }
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          esMenor={!!currentGuest.esMenor}
          onNext={() => nextGuest(nav.guestIndex, "form_personal")}
          onPartialSave={handlePartialSubmit}
          isSubmitting={isSubmitting}
          // FIX BUG HIGH #5: pasar token para leer modoFlujo correctamente
         token={token || "new"}
        />
      )}

      {currentStep === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(k: keyof PartialGuestData, v: unknown) =>
            updateGuest(nav.guestIndex, k, v)
          }
          onNext={() => nextGuest(nav.guestIndex, "form_contacto")}
          onPartialSave={handlePartialSubmit}
          hasNextGuest={state.numPersonas > 1}
          isSubmitting={isSubmitting}
        />
      )}

      {currentStep === "form_relaciones" && (
        <ScreenRelacionesMenor
          menor={currentGuest}
          adultos={adultosConIndice}
          onRelacionChange={(aIdx: number, p: string) =>
            // FIX BUG HIGH #3: nav.guestIndex ES el índice real del menor en state.guests
            // adultosConIndice ya tiene originalIndex = índice real en state.guests
            updateRelacion(nav.guestIndex, aIdx, p)
          }
          onNext={() => nextGuest(nav.guestIndex, "form_relaciones")}
          onPartialSave={handlePartialSubmit}
          hasNextMinor={
            state.guests.findIndex(
              (g, i) => i > nav.guestIndex && g.esMenor,
            ) >= 0
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
        {/* FIX BUG MEDIUM #5: wildcard ya no usa RedirectToBienvenida (token undefined) */}
        <Route path="*" element={<RedirectToNew />} />
      </Routes>
    </BrowserRouter>
  );
}