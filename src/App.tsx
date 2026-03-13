<<<<<<< HEAD
import React, { useEffect } from "react";
import { GLOBAL_CSS } from "./constants/styles";
import { useCheckin } from "./hooks/useCheckin";
import { AppShell } from "./layout/AppShell";
=======
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { GLOBAL_CSS } from './constants/styles';
import { useCheckin } from './hooks/useCheckin';
import { AppShell } from './layout/AppShell';
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b

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

<<<<<<< HEAD
import type { AppMode, StepId } from "./types";
=======
import type { StepId } from './types';
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b

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

<<<<<<< HEAD
// ─────────────────────────────────────────────────────────────────────────
// Cambia aquí el modo de la app:
//   'link'   → flujo de enlace por email (cliente llega desde un link)
//   'tablet' → flujo de quiosco en el hotel (búsqueda por número de reserva)
//
// En producción leerlo de la URL:
//   const APP_MODE: AppMode = new URLSearchParams(location.search).has('tablet') ? 'tablet' : 'link';
// ─────────────────────────────────────────────────────────────────────────
const APP_MODE: AppMode = "link";

const STEPS_WITHOUT_DOTS = new Set<StepId>(["tablet_buscar", "exito"]);
=======
const STEPS_WITHOUT_DOTS = new Set<StepId>(['tablet_buscar', 'exito']);
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b

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

<<<<<<< HEAD
  const { step, guestIndex } = nav;
  const showDots = !STEPS_WITHOUT_DOTS.has(step);
  const isMainGuest = guestIndex === 0;
  const currentGuest = state.guests[guestIndex] ?? {};
=======
  const currentStep = nav.step;
  const showDots   = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  // 3. Redirección de seguridad si falta el step
  if (!step) {
    return <Navigate to={`/checkin/${token}/bienvenida`} replace />;
  }
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b

  const handleChooseManual = () => {
    goTo("num_personas");
  };

  const handleConfirmKnown = () => {
    confirmKnownGuest();
    goTo("form_contacto");
  };

  // ── Tablet buscar ──────────────────────────────────────────────────────
<<<<<<< HEAD
  if (step === "tablet_buscar") {
=======
  if (currentStep === 'tablet_buscar') {
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
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
<<<<<<< HEAD
    <AppShell nav={nav} actions={{ goBack, goToDotIndex }} showDots={showDots}>
      {step === "bienvenida" && (
=======
    <AppShell
      nav={nav}
      actions={{ goBack, goToDotIndex }}
      showDots={showDots}
    >
      {currentStep === 'bienvenida' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => goTo("escanear")}
          onChooseManual={handleChooseManual}
        />
      )}

<<<<<<< HEAD
      {step === "num_personas" && (
=======
      {currentStep === 'num_personas' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenNumPersonas
          value={state.numPersonas}
          onChange={setNumPersonas}
          onNext={() => goTo("form_personal")}
        />
      )}

<<<<<<< HEAD
      {step === "confirmar_datos" && (
=======
      {currentStep === 'confirmar_datos' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={handleConfirmKnown}
        />
      )}

<<<<<<< HEAD
      {step === "escanear" && (
=======
      {currentStep === 'escanear' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data);
            goTo("num_personas");
          }}
          onSkip={() => goTo("num_personas")}
        />
      )}

<<<<<<< HEAD
      {step === "form_personal" && (
=======
      {currentStep === 'form_personal' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
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

<<<<<<< HEAD
      {step === "form_contacto" && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(guestIndex, key, value)}
          onNext={() => goTo("form_documento")}
        />
      )}

      {step === "form_documento" && (
=======
      {currentStep === 'form_contacto' && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          onNext={() => goTo('form_documento')}
        />
      )}

      {currentStep === 'form_documento' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenFormDocumento
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
<<<<<<< HEAD
          onNext={() => nextGuest(guestIndex, "form_documento")}
        />
      )}

      {step === "form_extras" && (
=======
          onNext={() => nextGuest(nav.guestIndex, 'form_documento')}
        />
      )}

      {currentStep === 'form_extras' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={setHoraLlegada}
          onObsChange={setObservaciones}
          onNext={() => goTo("revision")}
        />
      )}

<<<<<<< HEAD
      {step === "revision" && (
=======
      {currentStep === 'revision' && (
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
        <ScreenRevision
          state={state}
          onEditStep={(targetStep) => goTo(targetStep as StepId, "back")}
          onSubmit={() => goTo("exito")}
        />
      )}

<<<<<<< HEAD
      {step === "exito" && <ScreenExito state={state} />}
    </AppShell>
  );
}
=======
      {currentStep === 'exito' && (
        <ScreenExito state={state} />
      )}
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
        <Route path="*" element={<Navigate to="/checkin/new/bienvenida" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
>>>>>>> 2fbd90572bbe0e47c2bd530dcb364740ac2e0b7b
