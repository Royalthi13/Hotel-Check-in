import React, { useState, useRef, useEffect, useMemo } from "react";
import { GlobalToast } from "@/components/GlobalToast";
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
import "./FluidProgression.css";
import "./AppShell.css";
import { validatePersonal, validateContacto } from "../hooks/useFormValidation";
import { useCheckinContext } from "../context/useCheckinContext";
import type { TFunction } from "i18next";
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

// 🛡️ AHORA VALIDA TAMBIÉN LA PANTALLA DE INICIO
function currentStepIsInvalid(
  step: StepId,
  guests: PartialGuestData[],
  guestIndex: number,
  acceptedLegal: boolean,
  hayMenores: boolean,
  t: TFunction,
): boolean {
  const g = guests[guestIndex] ?? {};
  const logicalStep = getActiveSideStep(step);

  if (logicalStep === "inicio") {
    return !acceptedLegal || !hayMenores;
  }

  if (logicalStep === "form_personal") {
    return (
      Object.keys(validatePersonal({ ...g, isTitular: guestIndex === 0 }, t))
        .length > 0
    );
  }
  if (logicalStep === "form_contacto") {
    // Los menores no tienen contacto propio
    if (g.esMenor) return false;
    return Object.keys(validateContacto(g, t, { email: false, telefono: false })).length > 0;
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
  const { legalPassed, hasMinorsFlag } = useCheckinContext();
  const trackRef = useRef<HTMLDivElement>(null);
  const progressX = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const dotSteps = nav.dotSteps || [];
  const prevIndexRef = useRef(nav.dotIndex);

  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  // Progreso máximo alcanzado: state que sólo crece (nunca decrece).
  // La condición de guarda se chequea en el setter del useEffect, que es
  // válido porque sólo actualizamos cuando el nuevo valor es estrictamente mayor.
  const [maxDotReached, setMaxDotReached] = useState(0);
  const [maxSideIdxReached, setMaxSideIdxReached] = useState(0);
const canAdvance =
    nav.step !== "exito" &&
    (nav.step !== "revision" || nav.allowedSteps?.has("form_extras"));

  if (canAdvance) {
    if (nav.dotIndex > maxDotReached) {
      setMaxDotReached(nav.dotIndex);
    }
    if (activeIdx > maxSideIdxReached) {
      setMaxSideIdxReached(activeIdx);
    }
  }
  const { safeWidth, stepWidth, targetX } = useMemo(() => {
    const sw = Math.max(0, trackWidth - 6);
    const stw = dotSteps.length > 1 ? sw / (dotSteps.length - 1) : 0;
    const tx = Math.max(0, Math.min(nav.dotIndex, dotSteps.length - 1)) * stw;
    return { safeWidth: sw, stepWidth: stw, targetX: tx };
  }, [trackWidth, dotSteps.length, nav.dotIndex]);

  useEffect(() => {
    const measure = () => {
      if (trackRef.current) setTrackWidth(trackRef.current.offsetWidth);
    };
    measure();
    const t1 = setTimeout(measure, 50);
    const t2 = setTimeout(measure, 300);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("resize", measure);
    };
  }, [showDots]);

  useEffect(() => {
    if (trackWidth > 0) {
      if (prevIndexRef.current !== nav.dotIndex) {
        animate(progressX, targetX, {
          type: "spring",
          stiffness: 500,
          damping: 30,
        });
        prevIndexRef.current = nav.dotIndex;
      } else {
        progressX.stop();
        progressX.set(targetX);
      }
    }
  }, [trackWidth, targetX, progressX, nav.dotIndex]);

  const isStepUnlocked = (stepId: StepId, index: number) => {
    if (maxSideIdxReached === 0) return index === 0;

    if (stepId === "revision" && !!onGoToRevision && activeStep !== "exito")
      return true;

    if (nav.allowedSteps) return nav.allowedSteps.has(stepId);
    if (activeStep === "revision" || activeStep === "exito")
      return stepId === "bienvenida" || stepId === activeStep;
    return index <= activeIdx;
  };

 const stepInvalid =
    activeStep !== "revision" &&
    activeStep !== "exito" &&
    !!onGoToRevision &&
    currentStepIsInvalid(
      nav.step, guests, guestIndex, legalPassed, hasMinorsFlag, t,
    );
  const summaryDisabled =
    !onGoToRevision || activeStep === "revision" || activeStep === "exito";

  const handleDragEnd = () => {
    if (dotSteps.length <= 1 || trackWidth === 0) return;
    let landedIndex = Math.round(progressX.get() / stepWidth);
    landedIndex = Math.max(0, Math.min(landedIndex, dotSteps.length - 1));
    const targetStepId = dotSteps[landedIndex];
    const isAllowed =
      landedIndex <= maxDotReached || isStepUnlocked(targetStepId, landedIndex);
    const isBlockedByError =
      landedIndex > nav.dotIndex && stepInvalid && targetStepId !== "revision";

    if (isBlockedByError) window.dispatchEvent(new Event("FORCE_VALIDATE"));
    if (!isAllowed || isBlockedByError || landedIndex === nav.dotIndex) {
      animate(progressX, targetX, {
        type: "spring",
        stiffness: 500,
        damping: 30,
      });
      return;
    }
    actions.goToDotIndex(landedIndex);
  };

  const hotelDisplayName =
    (reserva as ExtendedReserva)?.hotelName ||
    (reserva as ExtendedReserva)?.establishment ||
    t("brand.name") ||
    "Lumina";

  return (
    <div
      className="shell"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <div
        className="card"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          onLogoClick={() => actions.goTo("inicio", "back", 0)}
          extraContent={<LanguageSelector />}
          name={hotelDisplayName}
          rightAction={
            onGoToRevision &&
            activeStep !== "revision" &&
            activeStep !== "exito" &&
            maxSideIdxReached > 0
              ? {
                  label: t("common.summary"),
                  icon: "clipboard",
                  onClick: () =>
                    stepInvalid
                      ? window.dispatchEvent(new Event("FORCE_VALIDATE"))
                      : onGoToRevision?.(),
                  disabled: summaryDisabled,
                }
              : undefined
          }
        />

        {showDots && dotSteps.length > 0 && nav.dotIndex >= 0 && (
          <div className="dots-bar">
            <div className="swipe-dots-track" ref={trackRef}>
              {trackWidth > 0 &&
                dotSteps.map((_, i) => {
                  const isDone = i <= maxDotReached && i !== nav.dotIndex;
                  const isActive = i === nav.dotIndex;
                  return (
                    <div
                      key={i}
                      className={`dot-static ${isDone ? "is-done" : ""}`}
                      style={{
                        opacity: isActive ? 0 : isDone ? 1 : 0.35,
                        transform: isActive ? "scale(0)" : "scale(1)",
                        backgroundColor: isDone
                          ? "var(--primary)"
                          : "rgba(255, 255, 255, 0.4)",
                        transition: "all 0.3s ease",
                      }}
                    />
                  );
                })}
              {trackWidth > 0 && (
                <motion.div
                  className="dot-pill-active"
                  style={{ x: progressX }}
                  drag="x"
                  dragConstraints={{ left: 0, right: safeWidth }}
                  dragElastic={0.1}
                  dragMomentum={false}
                  whileTap={{ scaleY: 1.4, scaleX: 1.05 }}
                  onDragEnd={handleDragEnd}
                />
              )}
            </div>
          </div>
        )}

        <div
          className="body-row"
          style={{ flex: 1, display: "flex", alignItems: "stretch" }}
        >
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
                  onClick={() =>
                    stepInvalid
                      ? window.dispatchEvent(new Event("FORCE_VALIDATE"))
                      : onGoToRevision?.()
                  }
                  disabled={summaryDisabled || maxSideIdxReached === 0}
                  style={{ opacity: maxSideIdxReached === 0 ? 0.3 : 1 }}
                >
                  <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                  {t("appShell.booking_summary")}
                </button>
              </div>

              {reserva && (
                <div className="sp-reserva">
                  <ReservationCard reserva={reserva} />
                </div>
              )}

              <nav className="sp-steps" aria-label="Progreso">
                {SIDE_STEPS.map((s, i) => {
                  const isActive = i === activeIdx;
                  const isUnlocked =
                    isStepUnlocked(s.id, i) ||
                    (maxSideIdxReached > 0 && i <= maxSideIdxReached);
                  const isRevision = s.id === "revision";

                  const canGoToRevision =
                    isRevision &&
                    !!onGoToRevision &&
                    !isActive &&
                    activeStep !== "exito" &&
                    maxSideIdxReached > 0;

                  const isClickable =
                    canGoToRevision ||
                    (isUnlocked && !isActive && s.id !== "exito");

                  const isDone =
                    i <= maxSideIdxReached &&
                    !isActive &&
                    !isRevision &&
                    s.id !== "exito";

                  const isGoingBackward = i < activeIdx;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        const isTargetRevision = s.id === "revision";

                        if (
                          stepInvalid &&
                          isClickable &&
                          !isActive &&
                          !isGoingBackward &&
                          !isTargetRevision
                        ) {
                          window.dispatchEvent(new Event("FORCE_VALIDATE"));
                          return;
                        }

                        if (canGoToRevision) {
                          onGoToRevision();
                          return;
                        }

                     if (isClickable) {
                          const dIdx = (nav.dotSteps || []).indexOf(s.id);
                          if (dIdx !== -1) actions.goToDotIndex(dIdx);
                          else
                            actions.goTo(
                              s.id,
                              isGoingBackward ? "back" : "forward",
                              0,
                            );
                        }
                      }}
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                        isClickable &&
                        (!stepInvalid || isGoingBackward || s.id === "revision")
                          ? "sp-step--clickable"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        cursor:
                          isClickable &&
                          (!stepInvalid ||
                            isGoingBackward ||
                            s.id === "revision")
                            ? "pointer"
                            : "default",
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
              flexDirection: "column",
              backgroundColor: "var(--white)",
              minHeight: "100%",
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
      <GlobalToast />
    </div>
  );
};
