import React from "react";
import { Header, DotsProgress, Icon } from "../components/ui";
import { DOT_LABELS } from "../constants";
import type {
  CheckinNav,
  CheckinActions,
  StepId,
  CheckinState,
} from "../types";

const SIDE_STEPS: { id: StepId; label: string }[] = [
  { id: "bienvenida", label: "Bienvenida" },
  { id: "num_personas", label: "N.º de personas" },
  { id: "form_personal", label: "Datos personales" },
  { id: "form_contacto", label: "Contacto" },
  { id: "form_documento", label: "Documento" },
  { id: "form_extras", label: "Preferencias" },
  { id: "revision", label: "Revisión" },
  { id: "exito", label: "Completado" },
];

const DOT_FOR: Partial<Record<StepId, StepId>> = {
  escanear: "form_personal",
  confirmar_datos: "form_personal",
};

function getActiveSideStep(step: StepId): StepId {
  return DOT_FOR[step] ?? step;
}

const isStepActuallyDone = (stepId: StepId, state: CheckinState): boolean => {
  if (!state) return false;

  const num = state.numPersonas || 1;
  const h = state.guests || [];

  switch (stepId) {
    case "bienvenida":
      return true;
    case "num_personas":
      return state.numPersonas > 0;
    case "form_personal":
      return (
        h.slice(0, num).length === num &&
        h.slice(0, num).every((g) => !!g?.nombre)
      );
    case "form_contacto":
      return !!h[0]?.email || !!h[0]?.telefono;
    case "form_documento":
      return (
        h.slice(0, num).length === num &&
        h.slice(0, num).every((g) => !!g?.numDoc)
      );
    case "form_extras":
      return !!state.horaLlegada && state.horaLlegada !== "No especificada";
    case "revision":
      return !!state.rgpdAcepted;
    case "exito":
      return false;
    default:
      return false;
  }
};

interface AppShellProps {
  nav: CheckinNav;
  actions: Pick<CheckinActions, "goBack" | "goToDotIndex" | "goTo">;
  showDots: boolean;
  state: CheckinState;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  nav,
  actions,
  showDots,
  state,
  children,
}) => {
  const dotLabels = nav.dotSteps.map((s: StepId) => DOT_LABELS[s] ?? s);
  const activeStep = getActiveSideStep(nav.step);
  const activeIdx = SIDE_STEPS.findIndex((s) => s.id === activeStep);

  const showOverviewBtn =
    nav.step !== "revision" &&
    nav.step !== "exito" &&
    nav.step !== "tablet_buscar";

  return (
    <div className="shell">
      <div className="card">
        <Header
          canGoBack={nav.canGoBack}
          onBack={actions.goBack}
          onOverview={
            showOverviewBtn ? () => actions.goTo("revision") : undefined
          }
        />

        {showDots && nav.dotIndex >= 0 && (
          <DotsProgress
            steps={nav.dotSteps}
            labels={dotLabels}
            activeIndex={nav.dotIndex}
            maxReachable={nav.dotIndex}
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

              {showOverviewBtn && (
                <button
                  className="btn-overview-trigger"
                  onClick={() => actions.goTo("revision")}
                  style={{
                    margin: "20px 0",
                    padding: "10px",
                    borderRadius: "8px",
                    background: "rgba(255,255,255,0.1)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    cursor: "pointer",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    transition: "all 0.2s ease",
                  }}
                >
                  <Icon name="search" size={14} color="var(--primary)" />
                  Resumen de la reserva
                </button>
              )}

              <nav className="sp-steps" aria-label="Progreso">
                {SIDE_STEPS.map((s, i) => {
                  const isActive = i === activeIdx;
                  const isDone = isStepActuallyDone(s.id, state);

                  return (
                    <button
                      key={s.id}
                      onClick={() => actions.goTo(s.id, "back")}
                      disabled={s.id === "exito" && activeIdx < 6}
                      className={[
                        "sp-step",
                        isActive ? "sp-step--active" : "",
                        isDone ? "sp-step--done" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      style={{
                        background: "none",
                        border: "none",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        padding: "8px 0",
                        opacity: isActive || isDone ? 1 : 0.6,
                      }}
                    >
                      <div className="sp-step-num">
                        {isDone ? (
                          <Icon name="check" size={10} color="#fff" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className="sp-step-label">{s.label}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="sp-footer">
                <Icon name="lock" size={12} color="rgba(255,255,255,.3)" />
                <span>Cifrado SSL · RGPD</span>
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
