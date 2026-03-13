import React, { useEffect } from 'react';
import { GLOBAL_CSS } from './constants/styles';
import { useCheckin } from './hooks/useCheckin';
import { AppShell } from './layout/AppShell';

// Screens
import { ScreenTabletBuscar }    from './screens/ScreenTabletBuscar';
import { ScreenBienvenida }       from './screens/ScreenBienvenida';
import { ScreenNumPersonas }      from './screens/ScreenNumPersonas';
import { ScreenEscanear }         from './screens/ScreenEscanear';
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

import type { AppMode, StepId } from './types';

// ── Inyecta el CSS en <head> para que aplique globalmente ──────────────
function useGlobalStyles(css: string) {
  useEffect(() => {
    let el = document.getElementById('app-global-styles') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'app-global-styles';
      document.head.appendChild(el);
    }
    el.textContent = css;
    return () => { if (el) el.textContent = ''; };
  }, [css]);
}

// ─────────────────────────────────────────────────────────────────────────
// Cambia aquí el modo de la app:
//   'link'   → flujo de enlace por email (cliente llega desde un link)
//   'tablet' → flujo de quiosco en el hotel (búsqueda por número de reserva)
//
// En producción leerlo de la URL:
//   const APP_MODE: AppMode = new URLSearchParams(location.search).has('tablet') ? 'tablet' : 'link';
// ─────────────────────────────────────────────────────────────────────────
const APP_MODE: AppMode = 'link';

const STEPS_WITHOUT_DOTS = new Set<StepId>(['tablet_buscar', 'exito']);

export default function App() {
  useGlobalStyles(GLOBAL_CSS);

  const [state, nav, actions] = useCheckin(APP_MODE);

  const {
    goTo, goBack, goToDotIndex,
    setReservaFromTablet, setNumPersonas,
    updateGuest, confirmKnownGuest, applyScannedData,
    setHoraLlegada, setObservaciones, nextGuest,
  } = actions;

  const { step, guestIndex } = nav;
  const showDots   = !STEPS_WITHOUT_DOTS.has(step);
  const isMainGuest = guestIndex === 0;
  const currentGuest = state.guests[guestIndex] ?? {};

  const handleChooseManual = () => {
    if (state.knownGuest) {
      goTo('confirmar_datos');
    } else {
      goTo('num_personas');
    }
  };

  const handleConfirmKnown = () => {
    confirmKnownGuest();
    goTo('form_contacto');
  };

  // ── Tablet buscar ──────────────────────────────────────────────────────
  if (step === 'tablet_buscar') {
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
    <AppShell
      nav={nav}
      actions={{ goBack, goToDotIndex }}
      showDots={showDots}
    >
      {step === 'bienvenida' && (
        <ScreenBienvenida
          knownGuest={state.knownGuest}
          reserva={state.reserva}
          onChooseScan={() => goTo('escanear')}
          onChooseManual={handleChooseManual}
        />
      )}

      {step === 'num_personas' && (
        <ScreenNumPersonas
          value={state.numPersonas}
          onChange={setNumPersonas}
          onNext={() => goTo('form_personal')}
        />
      )}

      {step === 'confirmar_datos' && (
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(guestIndex, key, value)}
          guestIndex={guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={handleConfirmKnown}
        />
      )}

      {step === 'escanear' && (
        <ScreenEscanear
          onScanned={(data) => {
            applyScannedData(data);
            goTo('num_personas');
          }}
          onSkip={() => goTo('num_personas')}
        />
      )}

      {step === 'form_personal' && (
        <ScreenFormPersonal
          data={currentGuest}
          onChange={(key, value) => updateGuest(guestIndex, key, value)}
          guestIndex={guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => {
            if (isMainGuest) {
              goTo('form_contacto');
            } else {
              goTo('form_documento');
            }
          }}
        />
      )}

      {step === 'form_contacto' && (
        <ScreenFormContacto
          data={currentGuest}
          onChange={(key, value) => updateGuest(guestIndex, key, value)}
          onNext={() => goTo('form_documento')}
        />
      )}

      {step === 'form_documento' && (
        <ScreenFormDocumento
          data={currentGuest}
          onChange={(key, value) => updateGuest(guestIndex, key, value)}
          guestIndex={guestIndex}
          totalGuests={state.numPersonas}
          isMainGuest={isMainGuest}
          onNext={() => nextGuest(guestIndex, 'form_documento')}
        />
      )}

      {step === 'form_extras' && (
        <ScreenFormExtras
          horaLlegada={state.horaLlegada}
          observaciones={state.observaciones}
          onHoraChange={setHoraLlegada}
          onObsChange={setObservaciones}
          onNext={() => goTo('revision')}
        />
      )}

      {step === 'revision' && (
        <ScreenRevision
          state={state}
          onEditStep={(targetStep) => goTo(targetStep as StepId, 'back')}
          onSubmit={() => goTo('exito')}
        />
      )}

      {step === 'exito' && (
        <ScreenExito state={state} />
      )}
    </AppShell>
  );
}