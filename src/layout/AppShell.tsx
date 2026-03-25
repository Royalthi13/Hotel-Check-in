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

  // 1. Declaración de Refs y Motion Values (Arriba para evitar errores de "used before declaration")
  const trackRef = useRef<HTMLDivElement>(null);
  const progressX = useMotionValue(0);
  const [trackWidth, setTrackWidth] = useState(0);
  const dotSteps = nav.dotSteps || [];

  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  // 2. Estado de progreso máximo alcanzado
  const [maxDotReached, setMaxDotReached] = useState(() =>
    nav.dotIndex >= 0 && nav.step !== "revision" && nav.step !== "exito"
      ? nav.dotIndex
      : 0,
  );

  useEffect(() => {
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

  // 3. Efecto de medición de ancho y sincronización inicial
  useEffect(() => {
    const measure = () => {
      if (trackRef.current) {
        const width = trackRef.current.offsetWidth;
        setTrackWidth(width);

        // Sincronizamos la posición de la píldora inmediatamente para evitar el salto a la izquierda
        if (dotSteps.length > 1) {
          const stepWidth = width / (dotSteps.length - 1);
          progressX.set(nav.dotIndex * stepWidth);
        }
      }
    };

    measure();
    const timer = setTimeout(measure, 100);
    window.addEventListener("resize", measure);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [showDots, dotSteps.length, nav.dotIndex, progressX]);

  // 4. Lógica de validación
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

  // 5. Función de final de arrastre (Ahora SÍ se usa correctamente abajo)
  const handleDragEnd = () => {
    if (dotSteps.length <= 1 || trackWidth === 0) return;
    const stepWidth = trackWidth / (dotSteps.length - 1);

    let landedIndex = Math.round(progressX.get() / stepWidth);
    landedIndex = Math.max(0, Math.min(landedIndex, dotSteps.length - 1));

    const targetStepId = dotSteps[landedIndex];
    const isAllowed =
      landedIndex <= maxDotReached || isStepUnlocked(targetStepId, landedIndex);
    const isBlockedByError = landedIndex > nav.dotIndex && stepInvalid;

    if (!isAllowed || isBlockedByError || landedIndex === nav.dotIndex) {
      // Si no puede ir, vuelve a su sitio con un muelle firme
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
    if (!summaryDisabled) onGoToRevision?.();
  };

  return (
    <div className="shell">
      <div className="card">
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          onLogoClick={() => actions.goTo("inicio", "back", 0)}
          extraContent={<LanguageSelector />}
          name={undefined}
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

        {/* 🟢 SLIDER SLEEK INSTAGRAM STYLE 🟢 */}
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
                onDragEnd={handleDragEnd} // 🟢 USAMOS LA FUNCIÓN AQUÍ 🟢
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
