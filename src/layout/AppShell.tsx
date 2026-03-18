import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
import type { CheckinNav, CheckinActions, StepId, Reserva } from "../types";

// ─── CONFIGURACIÓN DE PASOS ──────────────────────────────────────────────────
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
  nav: CheckinNav & { allowedSteps?: Set<StepId> };
  actions: Pick<CheckinActions, "goBack" | "goToDotIndex" | "goTo">;
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
  const { t } = useTranslation();

  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  const [maxDotReached, setMaxDotReached] = useState(
    nav.dotIndex >= 0 ? nav.dotIndex : 0,
  );
  if (nav.dotIndex > maxDotReached && nav.step !== "exito") {
    setMaxDotReached(nav.dotIndex);
  }

  const isStepUnlocked = (stepId: StepId, index: number) => {
    if (nav.allowedSteps) {
      return nav.allowedSteps.has(stepId);
    }
    if (activeStep === "revision" || activeStep === "exito") {
      return stepId === "bienvenida" || stepId === activeStep;
    }
    return index <= activeIdx;
  };

  return (
    <div className="shell">
      <div className="card">
        {/* Header */}
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          rightAction={
            onGoToRevision &&
            activeStep !== "revision" &&
            activeStep !== "exito"
              ? {
                  label: t("common.summary"),
                  icon: "users",
                  onClick: onGoToRevision,
                }
              : undefined
          }
        />

        {/* Dots (Móvil/Tablet) */}
        {showDots && nav.dotIndex >= 0 && (
          <DotsProgress
            steps={nav.dotSteps}
            labels={nav.dotSteps.map((s: StepId) => t(`constants.steps.${s}`))}
            activeIndex={nav.dotIndex}
            maxReachable={maxDotReached}
            onDotClick={actions.goToDotIndex}
          />
        )}

        <div className="body-row">
          <aside className="side-panel">
            <div className="side-panel-inner">
              <div className="sp-logo">
                <span>Lumina</span>
                <em>Hotels</em>
              </div>
              <p className="sp-sub">{t("appShell.subtitle")}</p>

              <div className="sp-summary-wrapper">
                {/* Botón Desktop */}
                <button
                  type="button"
                  className="sp-summary-btn sp-summary-btn--desktop"
                  onClick={onGoToRevision}
                  disabled={
                    !onGoToRevision ||
                    activeStep === "revision" ||
                    activeStep === "exito"
                  }
                >
                  <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                  {t("appShell.booking_summary")}
                </button>

                {/* Botón Tablet/Móvil */}
                <button
                  type="button"
                  className="sp-summary-btn-orange"
                  onClick={onGoToRevision}
                  disabled={
                    !onGoToRevision ||
                    activeStep === "revision" ||
                    activeStep === "exito"
                  }
                >
                  <Icon name="search" size={14} color="#fff" />
                  {t("appShell.booking_summary")}
                </button>
              </div>

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
                  const isActive = i === activeIdx;

                  const isUnlocked = isStepUnlocked(s.id, i);

                  const isClickable =
                    isUnlocked && !isActive && s.id !== "exito";

                  const isDone =
                    isUnlocked &&
                    !isActive &&
                    s.id !== "revision" &&
                    s.id !== "exito";

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isClickable) {
                          const dotIdxInNav = nav.dotSteps.indexOf(s.id);
                          if (dotIdxInNav !== -1) {
                            actions.goToDotIndex(dotIdxInNav);
                          } else {
                            actions.goTo(
                              s.id,
                              i < activeIdx ? "back" : "forward",
                            );
                          }
                        }
                      }}
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                        isClickable ? "sp-step--clickable" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={
                        {
                          cursor: isClickable ? "pointer" : "default",
                          opacity: isUnlocked ? 1 : 0.4,
                        } as React.CSSProperties
                      }
                    >
                      <div className="sp-step-num">
                        {isDone ? (
                          <Icon name="check" size={12} color="#fff" />
                        ) : (
                          i + 1
                        )}
                      </div>
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
