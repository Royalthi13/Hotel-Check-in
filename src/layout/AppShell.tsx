import React from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
// ✅ Ya no necesitamos importar DOT_LABELS, lo traduciremos dinámicamente
import type { CheckinNav, CheckinActions, StepId, Reserva } from "../types";

// 2. Quitamos el texto 'label' porque lo traduciremos en tiempo real
const SIDE_STEPS: { id: StepId }[] = [
  { id: "bienvenida" },
  { id: "num_personas" },
  { id: "form_personal" },
  { id: "form_contacto" },
  { id: "form_documento" },
  { id: "form_extras" },
  { id: "revision" },
  { id: "exito" },
];

const DOT_FOR: Partial<Record<StepId, StepId>> = {
  escanear: "form_personal",
  confirmar_datos: "form_personal",
};

function getActiveSideStep(step: StepId): StepId {
  return DOT_FOR[step] ?? step;
}

interface AppShellProps {
  nav: CheckinNav;
  actions: Pick<CheckinActions, "goBack" | "goToDotIndex">;
  showDots: boolean;
  reserva?: Reserva | null;
  onGoToRevision?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  nav,
  actions,
  showDots,
  reserva,
  onGoToRevision,
  children,
}) => {
  const { t } = useTranslation(); // 3. Inicializamos el traductor

  // 4. Traducimos los dots usando la clave de constantes
  const dotLabels = nav.dotSteps.map((s: StepId) => t(`constants.steps.${s}`));
  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <div className="shell">
      <div className="card">
        {/* Header — sticky, ancho completo */}
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          rightAction={
            onGoToRevision
              ? {
                  label: t("common.summary"),
                  icon: "users",
                  onClick: onGoToRevision,
                }
              : undefined
          }
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
              <p className="sp-sub">{t("appShell.subtitle")}</p>

              <button
                type="button"
                className="sp-summary-btn"
                onClick={onGoToRevision}
                disabled={!onGoToRevision}
              >
                <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                {t("appShell.booking_summary")}
              </button>

              {reserva && (
                <div className="sp-reserva">
                  <div className="sp-reserva-title">
                    {t("appShell.booking_summary")}
                  </div>
                  <ReservationCard reserva={reserva} />
                </div>
              )}

              <nav className="sp-steps" aria-label="Progreso">
                {SIDE_STEPS.map((s, i) => {
                  const isDone = i < activeIdx;
                  const isActive = i === activeIdx;
                  return (
                    <div
                      key={s.id}
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className="sp-step-num">
                        {isDone ? (
                          <Icon name="check" size={12} color="#fff" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      {/* Traducimos los pasos del menú lateral */}
                      <span className="sp-step-label">
                        {t(`constants.steps.${s.id}`)}
                      </span>
                    </div>
                  );
                })}
              </nav>

              <div className="sp-footer">
                <Icon name="lock" size={12} color="rgba(255,255,255,.3)" />
                <span>{t("appShell.privacy_short")}</span>
              </div>
            </div>
          </aside>

          {/* Contenido de la pantalla */}
          <div className="screen-wrap">
            <div
              className={`screen ${nav.direction === "back" ? "back" : ""}`}
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
