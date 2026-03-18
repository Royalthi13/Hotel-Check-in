import React from "react";
import { useTranslation } from "react-i18next";
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
import type { CheckinNav, CheckinActions, StepId, Reserva } from "../types";

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

  // 🧠 CERO ESTADOS LOCALES. LEEMOS LA VERDAD DEL HOOK DIRECTAMENTE.
  const allowed = nav.allowedSteps;

  // Calculamos cuál es el paso más lejano (índice) que está permitido.
  // Esto nos dirá hasta dónde poner los Ticks verdes.
  const highestAllowedIdx = SIDE_STEPS.reduce((max, s, i) => {
    return allowed?.has(s.id) ? Math.max(max, i) : max;
  }, activeIdx);

  // Lo mismo para los puntitos de arriba
  const highestDotIdx = nav.dotSteps.reduce(
    (max, s, i) => {
      return allowed?.has(s) ? Math.max(max, i) : max;
    },
    nav.dotIndex >= 0 ? nav.dotIndex : 0,
  );

  return (
    <div className="shell">
      <div className="card">
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

        {showDots && nav.dotIndex >= 0 && (
          <DotsProgress
            steps={nav.dotSteps}
            labels={nav.dotSteps.map((s: StepId) => t(`constants.steps.${s}`))}
            activeIndex={nav.dotIndex}
            maxReachable={highestDotIdx}
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

                  // 1. ¿Está permitido? (El hook lo sabe)
                  const isUnlocked = allowed?.has(s.id) || i <= activeIdx;

                  // 2. ¿Se puede clicar? (Cualquiera permitido menos en el que estoy)
                  const isClickable =
                    isUnlocked && !isActive && s.id !== "exito";

                  // 3. ¿Lleva el check verde? (Si está detrás del paso más lejano alcanzado)
                  const isDone =
                    i < highestAllowedIdx &&
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
