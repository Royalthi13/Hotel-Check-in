import React, { useState } from "react";
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
  const { t } = useTranslation();

  const dotLabels = (nav.dotSteps || []).map((s: StepId) =>
    t(`constants.steps.${s}`),
  );

  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  // 🧠 MEMORIA ESTRICTA: Nuestra "Marca de agua"
  const [highestIdx, setHighestIdx] = useState(activeIdx);
  const [prevActiveIdx, setPrevActiveIdx] = useState(activeIdx);

  const [highestDotIdx, setHighestDotIdx] = useState(
    nav.dotIndex >= 0 ? nav.dotIndex : 0,
  );
  const [prevDotIdx, setPrevDotIdx] = useState(nav.dotIndex);

  // Solo se actualiza la marca de agua si el usuario navega a un paso NUEVO y LEGAL
  if (activeIdx !== prevActiveIdx) {
    setPrevActiveIdx(activeIdx);
    if (
      activeIdx > highestIdx &&
      activeStep !== "revision" &&
      activeStep !== "exito"
    ) {
      setHighestIdx(activeIdx);
    }
  }

  // Esto controla a nivel de HUÉSPED (los puntitos)
  if (nav.dotIndex !== prevDotIdx) {
    setPrevDotIdx(nav.dotIndex);
    if (
      nav.dotIndex > highestDotIdx &&
      nav.step !== "revision" &&
      nav.step !== "exito"
    ) {
      setHighestDotIdx(nav.dotIndex);
    }
  }

  return (
    <div className="shell">
      <div className="card">
        {/* Header */}
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

        {/* Dots — Móvil/Tablet */}
        {showDots && nav.dotIndex >= 0 && (
          <DotsProgress
            steps={nav.dotSteps}
            labels={dotLabels}
            activeIndex={nav.dotIndex}
            // 🔥 SOLUCIÓN HUÉSPEDES: El máximo clicable es estrictamente hasta donde ha llegado.
            // Si no ha hecho el DNI del huésped 2, el punto del huésped 2 no es clicable.
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
                  className="sp-summary-btn sp-summary-btn--desktop"
                  onClick={onGoToRevision}
                  disabled={!onGoToRevision}
                >
                  <Icon name="search" size={14} color="rgba(255,255,255,.8)" />
                  {t("appShell.booking_summary")}
                </button>

                <button
                  type="button"
                  className="sp-summary-btn-orange"
                  onClick={onGoToRevision}
                  disabled={!onGoToRevision}
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

                  // 🔥 SOLUCIÓN MENÚ LATERAL:
                  // 1. Solo tiene check si está por debajo de nuestra marca de agua real.
                  const isDone = i < highestIdx;

                  // 2. Es clicable solo si está dentro de lo que ya hemos visitado.
                  // Se acabó el "pase VIP" por estar en la pantalla de revisión.
                  const isClickable =
                    i <= highestIdx && !isActive && s.id !== "exito";

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        if (isClickable) {
                          const targetIdx = nav.dotSteps.indexOf(s.id);
                          if (targetIdx !== -1) {
                            actions.goToDotIndex(targetIdx);
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
                      style={{
                        cursor: isClickable ? "pointer" : "default",
                        // Bloqueo visual estricto para lo que no se puede clicar
                        opacity: isClickable || isActive || isDone ? 1 : 0.4,
                      }}
                    >
                      <div className="sp-step-num">
                        {isDone && !isActive ? (
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
