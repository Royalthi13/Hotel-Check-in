import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
import type { CheckinNav, CheckinActions, StepId, Reserva } from "../types";
import { motion, AnimatePresence } from "framer-motion"; // Importamos la librería

const SIDE_STEPS: { id: StepId }[] = [
  { id: "bienvenida" },
  { id: "num_personas" },
  { id: "form_personal" },
  { id: "form_contacto" },
  { id: "form_extras" },
  { id: "revision" },
  { id: "exito" },
];

const DOT_FOR: Partial<Record<StepId, StepId>> = {
  escanear: "form_personal",
  confirmar_datos: "form_personal",
  form_relaciones: "form_personal",
};

function getActiveSideStep(step: StepId): StepId {
  return DOT_FOR[step] ?? step;
}

// Variantes para la animación de entrada y salida
const variants = {
  enter: (direction: string) => ({
    x: direction === "forward" ? 30 : -30,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: string) => ({
    x: direction === "forward" ? -30 : 30,
    opacity: 0,
  }),
};

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

  // Mantenemos tu lógica original de puntos de progreso
  const [maxDotReached, setMaxDotReached] = useState(
    nav.dotIndex >= 0 && nav.step !== "revision" && nav.step !== "exito"
      ? nav.dotIndex
      : 0,
  );

  if (
    nav.dotIndex > maxDotReached &&
    nav.step !== "exito" &&
    (nav.step !== "revision" ||
      (nav.allowedSteps && nav.allowedSteps.has("form_extras")))
  ) {
    setMaxDotReached(nav.dotIndex);
  }

  // Lógica crítica: Solo permite navegar a pasos que están en allowedSteps
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
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          name={reserva?.confirmacion} // Pasamos confirmación al header
          room={reserva?.habitacion} // Pasamos habitación al header
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
                              0,
                            );
                          }
                        }
                      }}
                      className={`sp-step ${isActive ? "sp-step--active" : ""} ${isDone ? "sp-step--done" : ""} ${isClickable ? "sp-step--clickable" : ""}`}
                      style={{
                        cursor: isClickable ? "pointer" : "default",
                        opacity: isUnlocked ? 1 : 0.4,
                      }}
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
            </div>
          </aside>

          {/* Aplicamos AnimatePresence aquí para las transiciones entre pantallas */}
          <main
            className="screen-wrap"
            style={{ position: "relative", overflowX: "hidden" }}
          >
            <AnimatePresence mode="wait" initial={false} custom={nav.direction}>
              <motion.div
                key={nav.step + (nav.guestIndex || 0)} // Key única para disparar la animación
                custom={nav.direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 300, damping: 30 },
                  opacity: { duration: 0.2 },
                }}
                className="screen"
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </div>
  );
};
