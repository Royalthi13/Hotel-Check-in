import { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import { GLOBAL_CSS } from "./constants/styles";
import { useCheckin } from "./hooks/useCheckin";
import { AppShell } from "./layout/AppShell";

// Screens
import { ScreenTabletBuscar } from "./screens/ScreenTabletBuscar";
import { ScreenBienvenida } from "./screens/ScreenBienvenida";
import { ScreenNumPersonas } from "./screens/ScreenNumPersonas";
import { ScreenEscanear } from "./screens/ScreenEscanear";
import {
  ScreenFormPersonal,
  ScreenFormContacto,
  ScreenFormDocumento,
} from "./screens/ScreenForms";
import {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from "./screens/ScreenExtrasRevisionExito";

import type { StepId } from "./types";

function useGlobalStyles(css: string) {
  useEffect(() => {
    let el = document.getElementById(
      "app-global-styles",
    ) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "app-global-styles";
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => {
      if (el) el.textContent = "";
    };
  }, [css]);
}

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);

function CheckinWizard() {
  // 1. Leemos el estado desde la URL
  const { token, step } = useParams();

  // 2. Pasamos token y step al hook
  const [state, nav, actions] = useCheckin(token, step);

  const {
    goTo,
    goBack,
    goToDotIndex,
    setReservaFromTablet,
    setNumPersonas,
    updateGuest,
    confirmKnownGuest,
    applyScannedData,
    setHoraLlegada,
    setObservaciones,
    nextGuest,
  } = actions;

  const currentStep = nav.step;
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  // 3. Redirección de seguridad si falta el step
  if (!step) {
    return <Navigate to={`/checkin/${token}/bienvenida`} replace />;
  }

  const handleChooseManual = () => {
    goTo("num_personas");
  };

  const handleConfirmKnown = () => {
    confirmKnownGuest();
    goTo("form_contacto");
  };

  // ── Tablet buscar ──────────────────────────────────────────────────────
  if (currentStep === "tablet_buscar") {
    return (
      <div className="shell">
        <div className="card">
          <ScreenTabletBuscar onFound={(res) => setReservaFromTablet(res)} />
        </div>
      </div>
    );
  }

  // ── Flujo principal ────────────────────────────────────────────────────
  return (
    <AppShell nav={nav} actions={{ goBack, goToDotIndex }} showDots={showDots}>
      {currentStep === "bienvenida" && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => goTo("escanear")}
          onChooseManual={handleChooseManual}
        />
      )}

      {currentStep === "num_personas" && (
        <ScreenNumPersonas
          value={state.numPersonas}
          onChange={setNumPersonas}
          onNext={() => goTo("form_personal")}
        />
      )}

      {currentStep === "confirmar_datos" && (
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={handleConfirmKnown}
        />
      )}

      {currentStep === "escanear" && (
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data);
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
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => {
            if (isMainGuest) {
              goTo("form_contacto");
            } else {
              goTo("form_documento");
            }
          }}
        />
      )}

      {currentStep === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          onNext={() => goTo("form_documento")}
        />
      )}

      {currentStep === "form_documento" && (
        <ScreenFormDocumento
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => nextGuest(nav.guestIndex, "form_documento")}
        />
      )}

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
        <ScreenRevision
          state={state}
          onEditStep={(targetStep) => goTo(targetStep as StepId, "back")}
          onSubmit={() => goTo("exito")}
        />
      )}

      {currentStep === "exito" && <ScreenExito state={state} />}
    </AppShell>
  );
}

// El App principal solo provee el Router
export default function App() {
  useGlobalStyles(GLOBAL_CSS);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/checkin/:token/:step?" element={<CheckinWizard />} />
        <Route
          path="*"
          element={<Navigate to="/checkin/new/bienvenida" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}
