import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useParams,
} from 'react-router-dom';
import './App.css';
import { useCheckin } from './hooks/useCheckin';
import { AppShell } from './layout/AppShell';
import { LoadingSpinner, Alert } from './components/ui';
import { useEffect, useRef, useState } from 'react';

import { ScreenTabletBuscar }   from './screens/ScreenTabletBuscar';
import { ScreenBienvenida }     from './screens/ScreenBienvenida';
import { ScreenNumPersonas }    from './screens/ScreenNumPersonas';
import { ScreenEscanear }       from './screens/ScreenEscanear';

// IMPORTANTE: el nombre del archivo en disco debe ser exactamente este.
// En Windows, TypeScript falla si el casing del import no coincide con el archivo.
// Si creaste el archivo como "ScreenConfirmardatos.tsx" (d minúscula),
// renómbralo a "ScreenConfirmarDatos.tsx" (D mayúscula) desde el explorador de archivos.
import { ScreenConfirmarDatos } from './screens/ScreenConfirmarDatos';

import {
  ScreenFormPersonal,
  ScreenFormContacto,
  ScreenFormDocumento,
} from './screens/ScreenForms';
import {
  ScreenFormExtras,
  ScreenRevision,
  ScreenExito,
} from './screens/ScreenExtrasRevisionExito';

import type { StepId } from './types';

const STEPS_WITHOUT_DOTS = new Set<StepId>(['tablet_buscar', 'exito']);

// Timeout de inactividad para modo tablet (5 minutos)
const TABLET_TIMEOUT_MS = 5 * 60 * 1000;

function RedirectToBienvenida() {
  const { token } = useParams();
  return <Navigate to={`/checkin/${token}/bienvenida`} replace />;
}

function CheckinWizard() {
  const { token, step } = useParams();
  const [state, nav, actions, isLoading] = useCheckin(token, step);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timeout de inactividad en modo tablet
  const tabletTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (state.appMode !== 'tablet') return;
    const reset = () => {
      clearTimeout(tabletTimeoutRef.current);
      tabletTimeoutRef.current = setTimeout(() => {
        sessionStorage.removeItem(`state_${token}`);
        sessionStorage.removeItem(`history_${token}`);
        sessionStorage.removeItem(`allowedSteps_${token}`);
        window.location.replace(`/checkin/${token}/tablet_buscar`);
      }, TABLET_TIMEOUT_MS);
    };
    reset();
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      clearTimeout(tabletTimeoutRef.current);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [state.appMode, token]);

  if (isLoading) {
    return (
      <div className="shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner text="Recuperando su reserva de forma segura…" />
      </div>
    );
  }

  const {
    goTo, goBack, goToDotIndex, setReservaFromTablet, setNumPersonas,
    updateGuest, applyScannedData, setHoraLlegada,
    setObservaciones, nextGuest, setRgpdAcepted,
  } = actions;

  const currentStep  = nav.step || 'bienvenida';
  const showDots     = !STEPS_WITHOUT_DOTS.has(currentStep);
  const isMainGuest  = nav.guestIndex === 0;
  const currentGuest = state.guests[nav.guestIndex] ?? {};

  const handleChooseManual = () => {
    if (state.knownGuest) {
      goTo('confirmar_datos');
    } else if (state.reserva) {
      goTo('form_personal');
    } else {
      goTo('num_personas');
    }
  };

  const handleSubmit = async () => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/checkin/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reserva: state.reserva,
          guests: state.guests.map(({ docFile: _f, ...rest }) => rest),
          horaLlegada: state.horaLlegada,
          observaciones: state.observaciones,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      goTo('exito');
    } catch (err) {
      console.error('Error al enviar check-in:', err);
      setSubmitError('Error al enviar los datos. Compruebe su conexión e inténtelo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Tablet buscar ──────────────────────────────────────────────────────
  if (currentStep === 'tablet_buscar') {
    return (
      <div className="shell">
        <div className="card">
          <ScreenTabletBuscar onFound={res => setReservaFromTablet(res)} />
        </div>
      </div>
    );
  }

  // ── Flujo principal ────────────────────────────────────────────────────
  return (
    <AppShell nav={nav} actions={{ goBack, goToDotIndex }} showDots={showDots}>

      {currentStep === 'bienvenida' && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => goTo('escanear')}
          onChooseManual={handleChooseManual}
        />
      )}

      {currentStep === 'num_personas' && (
        <ScreenNumPersonas
          value={state.numPersonas}
          onChange={setNumPersonas}
          onNext={() => goTo('form_personal')}
        />
      )}

      {currentStep === 'confirmar_datos' && (
        <ScreenConfirmarDatos
          guest={currentGuest}
          onConfirm={() => goTo('form_contacto')}
          onEdit={() => goTo('form_personal')}
        />
      )}

      {currentStep === 'escanear' && (
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data, nav.guestIndex);
            state.reserva ? goTo('form_personal') : goTo('num_personas');
          }}
          onSkip={() => {
            state.reserva ? goTo('form_personal') : goTo('num_personas');
          }}
        />
      )}

      {currentStep === 'form_personal' && (
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => nextGuest(nav.guestIndex, 'form_personal')}
        />
      )}

      {currentStep === 'form_contacto' && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          onNext={() => nextGuest(nav.guestIndex, 'form_contacto')}
        />
      )}

      {currentStep === 'form_documento' && (
        <ScreenFormDocumento
          data={currentGuest}
          onChange={(key, value) => updateGuest(nav.guestIndex, key, value)}
          guestIndex={nav.guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => nextGuest(nav.guestIndex, 'form_documento')}
        />
      )}

      {currentStep === 'form_extras' && (
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={setHoraLlegada}
          onObsChange={setObservaciones}
          onNext={() => goTo('revision')}
        />
      )}

      {currentStep === 'revision' && (
        <>
          {submitError && (
            <div style={{ padding: '8px 24px 0' }}>
              <Alert variant="err">{submitError}</Alert>
            </div>
          )}
          <ScreenRevision
            state={state}
            isSubmitting={isSubmitting}
            onEditStep={(targetStep) => goTo(targetStep as StepId, 'back')}
            onSubmit={handleSubmit}
            onRgpdChange={setRgpdAcepted}
          />
        </>
      )}

      {currentStep === 'exito' && <ScreenExito state={state} />}

    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/checkin/:token"       element={<RedirectToBienvenida />} />
        <Route path="/checkin/:token/:step" element={<CheckinWizard />} />
        <Route path="*"                     element={<Navigate to="/checkin/new/bienvenida" replace />} />
      </Routes>
    </BrowserRouter>
  );
}