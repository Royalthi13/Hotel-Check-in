import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Header, Icon, ReservationCard } from "../components/ui";
import type {
  CheckinNav,
  CheckinActions,
  StepId,
  Reserva,
  PartialGuestData,
} from "../types";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
} from "framer-motion";
import { LanguageSelector } from "../components/LanguageSelector";
import "@/App.css";
import { validatePersonal, validateContacto } from "../hooks/useFormValidation";
import "./FluidProgression.css";
import "./AppShell.css";

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
    return (
      Object.keys(validatePersonal({ ...g, isTitular: guestIndex === 0 }, t))
        .length > 0
    );
  }
  if (step === "form_contacto") {
    return Object.keys(validateContacto(g, t)).length > 0;
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

// 🟢 SOLUCIÓN TYPESCRIPT: Extendemos el tipo en lugar de usar "any"
type ExtendedReserva = Reserva & { hotelName?: string; establishment?: string };

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

  const trackRef = useRef<HTMLDivElement>(null);
  const progressX = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const dotSteps = nav.dotSteps || [];

  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  const [maxDotReached, setMaxDotReached] = useState(() =>
    nav.dotIndex >= 0 && nav.step !== "revision" && nav.step !== "exito"
      ? nav.dotIndex
      : 0,
  );

  // 🟢 SOLUCIÓN REACT: Evitamos el useEffect para derivar estado
  const shouldUpdateMaxDot =
    nav.dotIndex > maxDotReached &&
    nav.step !== "exito" &&
    (nav.step !== "revision" ||
      (nav.allowedSteps && nav.allowedSteps.has("form_extras")));

  if (shouldUpdateMaxDot) {
    setMaxDotReached(nav.dotIndex);
  }

  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        const width = trackRef.current.offsetWidth;
        setTrackWidth(width);
        if (dotSteps.length > 1) {
          const stepWidth = width / (dotSteps.length - 1);
          const targetX = nav.dotIndex * stepWidth;
          progressX.set(targetX);
        }
      }
    };
    measure();
    const timer = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [showDots, dotSteps.length, nav.dotIndex, progressX]);

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
    !onGoToRevision || activeStep === "revision" || activeStep === "exito";

  const handleDragEnd = () => {
    if (dotSteps.length <= 1 || trackWidth === 0) return;
    const stepWidth = trackWidth / (dotSteps.length - 1);

    let landedIndex = Math.round(progressX.get() / stepWidth);
    landedIndex = Math.max(0, Math.min(landedIndex, dotSteps.length - 1));

    const targetStepId = dotSteps[landedIndex];
    const isAllowed =
      landedIndex <= maxDotReached || isStepUnlocked(targetStepId, landedIndex);
    const isBlockedByError = landedIndex > nav.dotIndex && stepInvalid;

    if (isBlockedByError) {
      window.dispatchEvent(new Event("FORCE_VALIDATE"));
    }

    if (!isAllowed || isBlockedByError || landedIndex === nav.dotIndex) {
      animate(progressX, nav.dotIndex * stepWidth, {
        type: "spring",
        stiffness: 500,
        damping: 30,
      });
      return;
    }
    actions.goToDotIndex(landedIndex);
  };

  const handleGoToRevision = () => {
    if (stepInvalid) {
      window.dispatchEvent(new Event("FORCE_VALIDATE"));
      return;
    }
    if (!summaryDisabled) onGoToRevision?.();
  };

  const hotelDisplayName =
    (reserva as ExtendedReserva)?.hotelName ||
    (reserva as ExtendedReserva)?.establishment ||
    t("brand.name") ||
    "Lumina";

  return (
    <div className="shell">
      <div className="card">
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          onLogoClick={() => actions.goTo("inicio", "back", 0)}
          extraContent={<LanguageSelector />}
          name={hotelDisplayName}
          room={undefined}
          rightAction={
            onGoToRevision &&
            activeStep !== "revision" &&
            activeStep !== "exito"
              ? {
                  label: t("common.summary"),
                  icon: "clipboard",
                  onClick: handleGoToRevision,
                  disabled: summaryDisabled,
                }
              : undefined
          }
        />

        {showDots && dotSteps.length > 0 && nav.dotIndex >= 0 && (
          <div className="dots-bar">
            <div className="swipe-dots-track" ref={trackRef}>
              {dotSteps.map((_, i) => {
                const isDone = i < nav.dotIndex;
                const isActive = i === nav.dotIndex;

                return (
                  <div
                    key={i}
                    className={`dot-static ${isDone ? "is-done" : ""}`}
                    style={{
                      opacity: isActive ? 0 : isDone ? 0.5 : 1,
                      transform: isActive ? "scale(0)" : "scale(1)",
                      transition: "all 0.3s ease",
                    }}
                  />
                );
              })}
              <motion.div
                className="dot-pill-active"
                style={{ x: progressX }}
                drag="x"
                dragConstraints={trackRef}
                dragElastic={0.1}
                dragMomentum={false}
                whileTap={{ scaleY: 1.4, scaleX: 1.05 }}
                onDragEnd={handleDragEnd}
              />
            </div>
          </div>
        )}

        <div className="body-row">
          <aside className="side-panel">
            <div className="side-panel-inner">
              <div
                className="sp-logo"
                onClick={() => actions.goTo("inicio", "back", 0)}
                style={{ cursor: "pointer" }}
              >
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
                    stepInvalid ? t("appShell.fix_errors_tooltip") : undefined
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

                  const isRevision = s.id === "revision";
                  const canGoToRevision =
                    isRevision &&
                    !!onGoToRevision &&
                    !isActive &&
                    activeStep !== "exito";

                  const isClickable =
                    canGoToRevision ||
                    (isUnlocked && !isActive && s.id !== "exito");

                  const isDone =
                    isUnlocked && !isActive && !isRevision && s.id !== "exito";

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (
                          stepInvalid &&
                          (isClickable || isUnlocked) &&
                          !isActive
                        ) {
                          window.dispatchEvent(new Event("FORCE_VALIDATE"));
                          return;
                        }

                        if (canGoToRevision) {
                          onGoToRevision();
                          return;
                        }

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
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                        isClickable && !stepInvalid ? "sp-step--clickable" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        cursor:
                          isClickable && !stepInvalid ? "pointer" : "default",
                        opacity: isUnlocked || canGoToRevision ? 1 : 0.4,
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

              <div className="sp-footer">
                <Icon name="lock" size={12} color="rgba(255,255,255,.3)" />
                <span>{t("appShell.privacy_short")}</span>
              </div>
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
