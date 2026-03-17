import React from 'react';
import { Header, DotsProgress, Icon, ReservationCard } from '../components/ui';
import { DOT_LABELS } from '../constants';
// ✅ CheckinNav y CheckinActions viven en types/, no en el hook
import type { CheckinNav, CheckinActions, StepId, Reserva } from '../types';

const SIDE_STEPS: { id: StepId; label: string }[] = [
  { id: 'bienvenida',     label: 'Bienvenida'       },
  { id: 'num_personas',   label: 'N.º de personas'  },
  { id: 'form_personal',  label: 'Datos personales' },
  { id: 'form_contacto',  label: 'Contacto'         },
  { id: 'form_documento', label: 'Documento'        },
  { id: 'form_extras',    label: 'Preferencias'     },
  { id: 'revision',       label: 'Revisión'         },
  { id: 'exito',          label: 'Completado'       },
];

const DOT_FOR: Partial<Record<StepId, StepId>> = {
  escanear:        'form_personal',
  confirmar_datos: 'form_personal',
};

function getActiveSideStep(step: StepId): StepId {
  return DOT_FOR[step] ?? step;
}

interface AppShellProps {
  nav: CheckinNav;
  actions: Pick<CheckinActions, 'goBack' | 'goToDotIndex'>;
  showDots: boolean;
  reserva?: Reserva | null;
  onGoToRevision?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ nav, actions, showDots, reserva, onGoToRevision, children }) => {
  const dotLabels  = nav.dotSteps.map((s: StepId) => DOT_LABELS[s] ?? s);
  const activeStep = getActiveSideStep(nav.step);
  const activeIdx  = SIDE_STEPS.findIndex(s => s.id === activeStep);

  return (
    <div className="shell">
      <div className="card">

        {/* Header — sticky, ancho completo */}
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          rightAction={onGoToRevision ? { label: 'Resumen', icon: 'users', onClick: onGoToRevision } : undefined}
        />

        {/* Dots — solo móvil/tablet, en desktop los oculta el CSS */}
        {showDots && nav.dotIndex >= 0 && (
          <DotsProgress
            steps={nav.dotSteps}
            labels={dotLabels}
            activeIndex={nav.dotIndex}
            maxReachable={nav.dotIndex}
            onDotClick={actions.goToDotIndex}
          />
        )}

        {/* body-row: panel lateral (desktop) + contenido principal */}
        <div className="body-row">

          {/* Panel lateral — visible solo en desktop via CSS */}
          <aside className="side-panel">
            <div className="side-panel-inner">
              <div className="sp-logo">
                <span>Lumina</span>
                <em>Hotels</em>
              </div>
              <p className="sp-sub">
                Complete su pre check-in y llegue al hotel sin esperas en recepción.
              </p>

              <button
                type="button"
                className="sp-summary-btn"
                onClick={onGoToRevision}
                disabled={!onGoToRevision}
              >
                <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                Resumen de la reserva
              </button>

              {reserva && (
                <div className="sp-reserva">
                  <div className="sp-reserva-title">Resumen de la reserva</div>
                  <ReservationCard reserva={reserva} />
                </div>
              )}

              <nav className="sp-steps" aria-label="Progreso">
                {SIDE_STEPS.map((s, i) => {
                  const isDone   = i < activeIdx;
                  const isActive = i === activeIdx;
                  return (
                    <div
                      key={s.id}
                      className={[
                        'sp-step',
                        isActive ? 'sp-step--active' : '',
                        isDone   ? 'sp-step--done'   : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <div className="sp-step-num">
                        {isDone
                          ? <Icon name="check" size={12} color="#fff" />
                          : i + 1
                        }
                      </div>
                      <span className="sp-step-label">{s.label}</span>
                    </div>
                  );
                })}
              </nav>

              <div className="sp-footer">
                <Icon name="lock" size={12} color="rgba(255,255,255,.3)" />
                <span>Cifrado SSL · RGPD</span>
              </div>
            </div>
          </aside>

          {/* Contenido de la pantalla */}
          <div className="screen-wrap">
            <div
              className={`screen ${nav.direction === 'back' ? 'back' : ''}`}
              key={nav.step}
            >
              {children}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};