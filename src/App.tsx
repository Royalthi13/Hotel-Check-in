import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import "./App.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useCheckinContext } from "@/context/useCheckinContext";
import { AppShell } from "@/layout/AppShell";
import { LoadingSpinner, Alert, Icon } from "@/components/ui";
import { useTranslation } from "react-i18next";
import { CheckinProvider } from "@/context/CheckinContext";
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

import { ScreenLogin } from "@/screens/ScreenLogin";
import { ScreenTabletBuscar } from "@/screens/ScreenTabletBuscar";
import { isStaffLoggedIn, clearStaffToken } from "@/api/axiosInstance";
import type { StepId, Reserva } from "@/types";
import { ScreenVerificarAcceso } from "@/screens/ScreenVerificarAcceso";
import { ScreenHuespedIntermedio } from "@/screens/ScreenHuespedIntermedio";

const STEPS_WITHOUT_DOTS = new Set<StepId>([
  "tablet_login",
  "tablet_buscar",
  "exito",
]);

// ── Página de enlace inválido / caducado ──────────────────────────────────────
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

// ── Rutas del Kiosko (Staff) ──────────────────────────────────────────────────
function KioskoRoutes() {
  const navigate = useNavigate();

  if (isStaffLoggedIn()) {
    return <Navigate to="/buscar" replace />;
  }

  return (
    <div className="shell">
      <div className="card">
        <ScreenLogin onSuccess={() => navigate("/buscar")} />
      </div>
    </div>
  );
}

function KioskoBuscar() {
  const navigate = useNavigate();

  if (!isStaffLoggedIn()) {
    return <Navigate to="/new" replace />;
  }

  return (
    <div className="shell">
      <div className="card">
        <ScreenTabletBuscar
          onFound={(res, bookingId, clientId) => {
            sessionStorage.setItem(
              "kiosko_booking",
              JSON.stringify({ res, bookingId, clientId }),
            );
            // El recepcionista va directo al inicio del checkin
            navigate(`/checkin/kiosko-${bookingId}/inicio`);
          }}
        />
      </div>
    </div>
  );
}

function LogoutKiosko() {
  const navigate = useNavigate();
  useEffect(() => {
    clearStaffToken();
    navigate("/new", { replace: true });
  }, [navigate]);
  return null;
}

// ── Lógica del Wizard ─────────────────────────────────────────────────────────
function CheckinWizard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
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
    accessVerified,
    setAccessVerified,
  } = useCheckinContext();

  const isKiosko = token.startsWith("kiosko");

  // Incluye kiosko: ahí también hay que esperar a loadCheckinData (Bearer staff).
  const isActuallyLoading = isLoading && token !== "new";

  const needsVerification = !accessVerified && token !== "new" && !isKiosko;

  if (needsVerification && !isLoading) {
    return (
      <div className="shell">
        <div className="card">
          <ScreenVerificarAcceso
            accessCode={token}
            bookingRef={state.reserva?.confirmacion ?? `#${state.bookingId}`}
            onSuccess={() => {
              setAccessVerified(true);
              window.location.reload();
            }}
            onTooManyAttempts={() => navigate("/invalid", { replace: true })}
          />
        </div>
      </div>
    );
  }

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
  const currentGuest = state.guests[nav.guestIndex] ?? {};
  const adultosConIndice = state.guests
    .map((g, i) => ({ ...g, originalIndex: i }))
    .filter((g) => !g.esMenor);

  return (
    <AppShell
      nav={nav}
      actions={{
        goBack: actions.goBack,
        goToDotIndex: actions.goToDotIndex,
        goTo: currentStep === "exito" ? () => {} : actions.goTo,
      }}
      showDots={showDots}
      reserva={state.reserva}
      onGoToRevision={
        currentStep === "exito"
          ? undefined
          : () => actions.goTo("revision", "back")
      }
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
            if (isKiosko) {
              // Salto para Staff: De inicio a formulario
              actions.goTo("form_personal", "forward");
            } else {
              actions.goTo("bienvenida", "forward");
            }
          }}
        />
      )}

      {currentStep === "bienvenida" && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          guestIndex={nav.guestIndex}
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

      {currentStep === "huesped_intermedio" &&
        (isKiosko ? (
          <Navigate to={`/checkin/${token}/form_personal`} replace />
        ) : (
          <ScreenHuespedIntermedio />
        ))}

      {currentStep === "form_relaciones" && (
        <ScreenRelacionesMenor
          menor={currentGuest}
          adultos={adultosConIndice}
          onRelacionChange={(aIdx: number, p: string) => {
            actions.updateRelacion(nav.guestIndex, aIdx, p);
          }}
          onNext={() => {
            actions.nextGuest(nav.guestIndex, "form_relaciones");
          }}
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

// ── Listener global de expiración de auth ─────────────────────────────────────
function AuthExpiredWatcher() {
  const navigate = useNavigate();
  useEffect(() => {
    const handler = () => {
      const path = window.location.pathname;
      const isPreCheckinLink =
        path.startsWith("/checkin/") && !path.includes("/kiosko");
      if (isPreCheckinLink) {
        const parts = path.split("/");
        navigate(`/checkin/${parts[2]}`, { replace: true });
      } else {
        navigate("/invalid", { replace: true });
      }
    };
    window.addEventListener("AUTH_EXPIRED", handler);
    return () => window.removeEventListener("AUTH_EXPIRED", handler);
  }, [navigate]);
  return null;
}

// ── Rutas de la Aplicación ───────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthExpiredWatcher />
      <Routes>
        <Route path="/" element={<Navigate to="/new" replace />} />

        {/* Rutas Kiosko */}
        <Route path="/new" element={<KioskoRoutes />} />
        <Route path="/buscar" element={<KioskoBuscar />} />
        <Route path="/logout" element={<LogoutKiosko />} />

        {/* Flujo Checkin */}
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
