import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./App.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { CheckinProvider, useCheckinContext } from "@/context/CheckinContext";
import { AppShell } from "@/layout/AppShell";
import { LoadingSpinner, Alert, Icon } from "@/components/ui";
import { useTranslation } from "react-i18next";

// --- PANTALLAS ---
import { ScreenTabletBuscar } from "@/screens/ScreenTabletBuscar";
import { ScreenBienvenida } from "@/screens/ScreenBienvenida";
import { ScreenCheckinInicio } from "@/screens/ScreenCheckinInicio";
import { ScreenEscanear } from "@/screens/ScreenEscanear";
import { ScreenRelacionesMenor } from "@/screens/ScreenRelacionesMenor";
import { ScreenFormPersonal, ScreenFormContacto } from "@/screens/ScreenForms";
import {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from "@/screens/ScreenExtrasRevisionExito";

import type { StepId, Reserva } from "@/types";

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);

// ── Página de enlace inválido / caducado ──────────────────────────────────────
// Dentro de App.tsx
function InvalidLink() {
  const { t } = useTranslation();
  return (
    <div
      className="shell"
      style={{ alignItems: "center", justifyContent: "center" }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--white)",
          borderRadius: "var(--r-xl)",
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: "0 12px 56px rgba(50,65,84,0.13)",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--bg)",
            border: "2px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Icon name="lock" size={32} color="var(--text-low)" />
        </div>
        <h2
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 26,
            fontWeight: 400,
            color: "var(--text)",
            marginBottom: 12,
          }}
        >
          {t("invalidLink.title")}
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "var(--text-mid)",
            lineHeight: 1.65,
            maxWidth: 320,
            margin: "0 auto",
          }}
        >
          {t("invalidLink.description")}
        </p>
        <p style={{ marginTop: 20, fontSize: 12, color: "var(--text-low)" }}>
          {t("invalidLink.help")}
        </p>
      </div>
    </div>
  );
}

// ── Lógica del Wizard (Se mantiene igual que tu código) ───────────────────────
function CheckinWizard() {
  const { t } = useTranslation();
  const {
    state,
    nav,
    actions,
    isLoading,
    isOffline,
    submitError,
    isSubmitting,
    isPartialSuccess,
    setHasMinorsFlag,
    setLegalPassed,
    handleChooseMethod,
    handleSubmit,
    token,
  } = useCheckinContext();

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

  const currentStep = nav.step || "inicio";
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const customNav = { ...nav, canGoBack: nav.canGoBack };
  const currentGuest = state.guests[nav.guestIndex] ?? {};
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
      actions={{
        goBack: actions.goBack,
        goToDotIndex: actions.goToDotIndex,
        goTo: actions.goTo,
      }}
      showDots={showDots}
      reserva={state.reserva}
      onGoToRevision={() => actions.goTo("revision", "back")}
      guests={state.guests}
      guestIndex={nav.guestIndex}
    >
      {isOffline && (
        <div style={{ padding: "8px var(--px) 0" }}>
          <Alert variant="warm">{t("search.error_connection")}</Alert>
        </div>
      )}

      {currentStep === "inicio" && (
        <ScreenCheckinInicio
          reserva={state.reserva as Reserva}
          onNext={(hayMenores: boolean) => {
            setHasMinorsFlag(hayMenores);
            setLegalPassed(true);
            actions.goTo("bienvenida", "forward");
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

      {currentStep === "escanear" && (
        <ScreenEscanear
          onScanned={(data) => {
            actions.applyScannedData(data, nav.guestIndex);
            actions.goTo("form_personal", "forward");
          }}
          onSkip={() => actions.goTo("form_personal", "forward")}
        />
      )}

      {currentStep === "form_personal" && <ScreenFormPersonal />}
      {currentStep === "form_contacto" && <ScreenFormContacto />}

      {currentStep === "form_relaciones" && (
        <ScreenRelacionesMenor
          menor={currentGuest}
          adultos={adultosConIndice}
          onRelacionChange={(aIdx: number, p: string) =>
            actions.updateRelacion(nav.guestIndex, aIdx, p)
          }
          onNext={() => actions.nextGuest(nav.guestIndex, "form_relaciones")}
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
          onNext={() => actions.goTo("revision", "forward")}
        />
      )}

      {currentStep === "revision" && (
        <>
          {submitError && (
            <div style={{ padding: "8px var(--px) 0" }}>
              <Alert variant="err">{submitError}</Alert>
            </div>
          )}
          <ScreenRevision
            state={state}
            isSubmitting={isSubmitting}
            onEditStep={(targetStep, gIdx) =>
              actions.goTo(targetStep as StepId, "back", gIdx)
            }
            onSubmit={handleSubmit || (() => Promise.resolve())}
          />
        </>
      )}

      {currentStep === "exito" && (
        <ScreenExito
          state={state}
          onAddHora={() => actions.goTo("form_extras", "back")}
          isPartial={isPartialSuccess}
        />
      )}
    </AppShell>
  );
}

// ── Rutas de la Aplicación ───────────────────────────────────────────────────
//
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 1. Si alguien entra a la raíz (/), el sistema asume que es personal del hotel.
               Redirigimos a /checkin/new. El Hook detectará el "new" y mostrará la búsqueda. */}
        <Route path="/" element={<Navigate to="/checkin/new" replace />} />

        {/* 2. Ruta para el staff/tablet específica (opcional, por si la usas directamente) */}
        <Route
          path="/checkin/kiosko/tablet_buscar"
          element={
            <ErrorBoundary>
              <CheckinProvider>
                <CheckinWizard />
              </CheckinProvider>
            </ErrorBoundary>
          }
        />

        {/* 3. CAMBIO CLAVE: Quitamos el Navigate a "inicio". 
               Ahora cargamos el Wizard directamente. Él decidirá qué pantalla mostrar 
               según si el token es "new" o un código real. */}
        <Route
          path="/checkin/:token"
          element={
            <ErrorBoundary>
              <CheckinProvider>
                <CheckinWizard />
              </CheckinProvider>
            </ErrorBoundary>
          }
        />

        {/* 4. Ruta para pasos específicos del flujo */}
        <Route
          path="/checkin/:token/:step"
          element={
            <ErrorBoundary>
              <CheckinProvider>
                <CheckinWizard />
              </CheckinProvider>
            </ErrorBoundary>
          }
        />

        <Route path="/invalid" element={<InvalidLink />} />
        <Route path="*" element={<InvalidLink />} />
      </Routes>
    </BrowserRouter>
  );
}
