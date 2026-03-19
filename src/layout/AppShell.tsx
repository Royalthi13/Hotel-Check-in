import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
import type { CheckinNav, CheckinActions, StepId, Reserva } from "../types";
import { motion, AnimatePresence } from "framer-motion";

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

const variants = {
  enter: (direction: string) => ({
    x: direction === "forward" ? 100 : -100,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: string) => ({
    x: direction === "forward" ? -100 : 100,
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

  const isStepUnlocked = (stepId: StepId) => {
    return nav.allowedSteps?.has(stepId) || stepId === "bienvenida";
  };

  return (
    <div className="shell">
      <div className="card">
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          name={reserva?.confirmacion}
          room={reserva?.habitacion}
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
            maxReachable={nav.dotIndex} // Simplificado para que los puntos reflejen donde estas
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
                  <Icon name="search" size={14} color="rgba(255,255,255,.8)" />{" "}
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
              <nav className="sp-steps">
                {SIDE_STEPS.map((s, i) => {
                  const isActive = i === activeIdx;
                  const isUnlocked = isStepUnlocked(s.id);
                  const isDone =
                    isUnlocked &&
                    !isActive &&
                    s.id !== "revision" &&
                    s.id !== "exito";
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isUnlocked && !isActive) {
                          const dotIdxInNav = nav.dotSteps.indexOf(s.id);
                          if (dotIdxInNav !== -1)
                            actions.goToDotIndex(dotIdxInNav);
                          else
                            actions.goTo(
                              s.id,
                              i < activeIdx ? "back" : "forward",
                              0,
                            );
                        }
                      }}
                      className={`sp-step ${isActive ? "sp-step--active" : ""} ${isDone ? "sp-step--done" : ""} ${isUnlocked && !isActive ? "sp-step--clickable" : ""}`}
                      style={{
                        cursor: isUnlocked && !isActive ? "pointer" : "default",
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

          <main
            className="screen-wrap"
            style={{
              position: "relative",
              overflowX: "hidden",
              display: "flex",
              flex: 1,
            }}
          >
            <AnimatePresence mode="wait" initial={false} custom={nav.direction}>
              <motion.div
                key={nav.step + (nav.guestIndex || 0)} // Key unica para que la animación salte entre huéspedes
                custom={nav.direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{
                  x: { type: "spring", stiffness: 260, damping: 26 },
                  opacity: { duration: 0.2 },
                }}
                style={{
                  width: "100%",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                }}
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
