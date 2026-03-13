import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from "react-router-dom";
import './app.css';
import { useCheckin } from "./hooks/useCheckin";
import { AppShell } from "./layout/AppShell";
import { LoadingSpinner } from "./components/ui"; // <-- AÑADIDO: Importamos el Spinner

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

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);

// 🛡️ DEFENSA: Componente helper para redirigir URLs limpias sin romper React
function RedirectToBienvenida() {
  const { token } = useParams();
  return <Navigate to={`/checkin/${token}/bienvenida`} replace />;
}

function CheckinWizard() {
  const { token, step } = useParams();

  // 1. AHORA SÍ recogemos el isLoading (4º parámetro)
  const [state, nav, actions, isLoading] = useCheckin(token, step);

  // 2. BLOQUEO DE UI: Si está cargando datos de MSW, no renderizamos el wizard aún
  if (isLoading) {
    return (
      <div className="shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Recuperando reserva segura..." />
      </div>
    );
  }

  const {
    goTo, goBack, goToDotIndex, setReservaFromTablet, setNumPersonas,
    updateGuest, confirmKnownGuest, applyScannedData, setHoraLlegada,
    setObservaciones, nextGuest,
  } = actions;

  // Si por algún motivo step es undefined aquí, usamos 'bienvenida' por defecto
  const currentStep = nav.step || 'bienvenida';
  const showDots = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  const handleChooseManual = () => goTo("num_personas");
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

// El App principal configura el Router y delega las redirecciones a la capa de rutas
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Si entran con el token pero sin paso, redirigimos a bienvenida */}
        <Route path="/checkin/:token" element={<RedirectToBienvenida />} />
        
        {/* Si entran con token y paso, abrimos el Wizard */}
        <Route path="/checkin/:token/:step" element={<CheckinWizard />} />
        
        {/* Cualquier otra ruta errónea, forzamos un token nuevo y bienvenida */}
        <Route path="*" element={<Navigate to="/checkin/new/bienvenida" replace />} />
      </Routes>
    </BrowserRouter>
  );
}