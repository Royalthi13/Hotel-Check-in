import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Header, DotsProgress, Icon, ReservationCard } from "../components/ui";
import type { CheckinNav, CheckinActions, StepId, Reserva, PartialGuestData } from "../types";
import { motion, AnimatePresence } from "framer-motion";
import { LanguageSelector } from "../components/LanguageSelector";
import "@/App.css";
import { validatePersonal, validateContacto } from "../hooks/useFormValidation";

const SIDE_STEPS: { id: StepId }[] = [
  { id: "inicio" },
  { id: "bienvenida" },
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

function currentStepIsInvalid(
  step: StepId,
  guests: PartialGuestData[],
  guestIndex: number,
  t: ReturnType<typeof useTranslation>["t"],
): boolean {
  const g = guests[guestIndex] ?? {};

  if (step === "form_personal" || step === "escanear") {
    const errors = validatePersonal({ ...g, isTitular: guestIndex === 0 }, t);
    return Object.keys(errors).length > 0;
  }

  if (step === "form_contacto") {
    const errors = validateContacto(g, t);
    return Object.keys(errors).length > 0;
  }

  return false;
}

const variants = {
  enter: (direction: string) => ({
    x: direction === "forward" ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: string) => ({
    x: direction === "forward" ? -80 : 80,
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
  guests?: PartialGuestData[];
  guestIndex?: number;
}

export const AppShell: React.FC<AppShellProps> = ({
  nav,
  actions,
  showDots,
  reserva,
  onGoToRevision,
  children,
  guests = [],
  guestIndex = 0,
}) => {
  const { t } = useTranslation();
  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);
  const [maxDotReached, setMaxDotReached] = useState(() =>
    nav.dotIndex >= 0 && nav.step !== "revision" && nav.step !== "exito"
      ? nav.dotIndex
      : 0,
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMaxDotReached((prev) => {
      if (
        nav.dotIndex > prev &&
        nav.step !== "exito" &&
        (nav.step !== "revision" ||
          (nav.allowedSteps && nav.allowedSteps.has("form_extras")))
      ) {
        return nav.dotIndex;
      }
      return prev;
    });
  }, [nav.dotIndex, nav.step, nav.allowedSteps]);

  const isStepUnlocked = (stepId: StepId, index: number) => {
    if (nav.allowedSteps) return nav.allowedSteps.has(stepId);
    if (activeStep === "revision" || activeStep === "exito") {
      return stepId === "bienvenida" || stepId === activeStep;
    }
    return index <= activeIdx;
  };

  const stepInvalid =
    activeStep !== "revision" &&
    activeStep !== "exito" &&
    !!onGoToRevision &&
    currentStepIsInvalid(nav.step, guests, guestIndex, t);

  const summaryDisabled =
    !onGoToRevision ||
    activeStep === "revision" ||
    activeStep === "exito" ||
    stepInvalid;

  const handleGoToRevision = () => {
    if (!summaryDisabled) onGoToRevision?.();
  };

  return (
    <div className="shell">
      <div className="card">
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          extraContent={<LanguageSelector />}
          name={reserva?.confirmacion}
          room={reserva?.habitacion}
          rightAction={
            onGoToRevision && activeStep !== "revision" && activeStep !== "exito"
              ? {
                label: t("common.summary"),
                icon: "clipboard",
                onClick: handleGoToRevision,
                disabled: summaryDisabled,
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
          {/* Panel Lateral Desktop */}
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
                  onClick={handleGoToRevision}
                  disabled={summaryDisabled}
                  title={
                    stepInvalid
                      ? "Corrige los errores del formulario antes de continuar"
                      : undefined
                  }
                >
                  <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                  {t("appShell.booking_summary")}
                </button>

                <button
                  type="button"
                  className="sp-summary-btn-orange"
                  onClick={handleGoToRevision}
                  disabled={summaryDisabled}
                  title={
                    stepInvalid
                      ? "Corrige los errores del formulario antes de continuar"
                      : undefined
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
                  const isClickable = isUnlocked && !isActive && s.id !== "exito";
                  const isDone =
                    isUnlocked && !isActive && s.id !== "revision" && s.id !== "exito";

                  return (
                    <div
                      key={s.id}
                      onClick={() =>
                        isClickable &&
                        (nav.dotSteps.indexOf(s.id) !== -1
                          ? actions.goToDotIndex(nav.dotSteps.indexOf(s.id))
                          : actions.goTo(s.id, i < activeIdx ? "back" : "forward", 0))
                      }
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                        isClickable ? "sp-step--clickable" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        cursor: isClickable ? "pointer" : "default",
                        opacity: isUnlocked ? 1 : 0.4,
                      }}
                    >
                      <div className="sp-step-num">
                        {isDone ? <Icon name="check" size={12} color="#fff" /> : i + 1}
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

          {/* Área de contenido con animaciones Framer Motion */}
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
                key={nav.step + (nav.guestIndex || 0)}
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
