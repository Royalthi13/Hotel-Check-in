import React from "react";
import { Typography, Box } from "@mui/material";
import { Field, Button, Alert, ConfirmBlock, Icon } from "@/components/ui";
import { HORAS_LLEGADA } from "@/constants";
import type { CheckinState } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════
// 1. FORM EXTRAS
// ═══════════════════════════════════════════════════════════════════════════
interface FormExtrasProps {
  horaLlegada: string;
  observaciones: string;
  onHoraChange: (v: string) => void;
  onObsChange: (v: string) => void;
  onNext: () => void;
}

export const ScreenFormExtras: React.FC<FormExtrasProps> = ({
  horaLlegada,
  observaciones,
  onHoraChange,
  onObsChange,
  onNext,
}) => (
  <>
    <div className="sec-hdr">
      <Typography
        variant="h2"
        sx={{
          fontFamily: "Cormorant Garamond, serif",
          fontSize: "var(--fs-2xl)",
        }}
      >
        Preferencias y extras
      </Typography>
      <p>Información adicional opcional para su estancia.</p>
    </div>

    <div className="fields" style={{ marginTop: 12 }}>
      <div className="divlabel">Llegada</div>
      <Field label="Hora estimada de llegada">
        <select
          value={horaLlegada}
          onChange={(e) => onHoraChange(e.target.value)}
        >
          {HORAS_LLEGADA.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </Field>

      <div className="divlabel">Peticiones especiales</div>
      <Field label="Observaciones o solicitudes">
        <textarea
          rows={4}
          value={observaciones}
          onChange={(e) => onObsChange(e.target.value)}
          placeholder="Cuna, alergias, habitación planta alta..."
        />
      </Field>
    </div>

    <div className="spacer" />
    <div className="btn-row">
      <Button variant="primary" iconRight="right" onClick={onNext}>
        Revisar y confirmar
      </Button>
    </div>
  </>
);

// ═══════════════════════════════════════════════════════════════════════════
// 2. REVISION
// ═══════════════════════════════════════════════════════════════════════════
interface ScreenRevisionProps {
  state: CheckinState;
  isSubmitting: boolean;
  onEditGuest: (index: number) => void;
  onSubmit: () => void;
  onRgpdChange: (v: boolean) => void;
}

export const ScreenRevision: React.FC<ScreenRevisionProps> = ({
  state,
  isSubmitting,
  onEditGuest,
  onSubmit,
  onRgpdChange,
}) => {
  const infoGrupo = Array.from({ length: state.numPersonas }).map((_, i) => {
    const g = state.guests[i];
    const esValido = !!(g?.nombre && g?.numDoc);
    return {
      index: i,
      nombre: g?.nombre || `Huésped ${i + 1}`,
      esValido,
      datos: g,
    };
  });

  const pendientes = infoGrupo.filter((h) => !h.esValido);
  const todoOk = pendientes.length === 0;

  return (
    <div className="screen">
      <div className="sec-hdr">
        <Typography
          variant="h2"
          sx={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "var(--fs-2xl)",
          }}
        >
          Revisión del grupo
        </Typography>
        <p>
          {todoOk
            ? "✓ Todo listo"
            : `Faltan datos de ${pendientes.length} personas.`}
        </p>
      </div>

      <Box
        sx={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {pendientes.length > 0 && (
          <Alert variant="warm">
            <strong style={{ display: "block", marginBottom: "8px" }}>
              Pendientes de completar:
            </strong>
            {pendientes.map((p) => (
              <div
                key={p.index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <span>• {p.nombre}</span>
                <button
                  onClick={() => onEditGuest(p.index)}
                  style={{
                    color: "var(--primary)",
                    fontWeight: "bold",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    fontSize: "12px",
                  }}
                >
                  RELLENAR AHORA
                </button>
              </div>
            ))}
          </Alert>
        )}

        {infoGrupo
          .filter((h) => h.esValido)
          .map((h) => (
            <ConfirmBlock
              key={h.index}
              title={h.nombre}
              onEdit={() => onEditGuest(h.index)}
              rows={[
                ["Documento", `${h.datos?.tipoDoc} ${h.datos?.numDoc}`],
                [
                  "Vínculos",
                  h.datos?.parentescos ? "Registrados" : "No requeridos",
                ],
              ]}
            />
          ))}

        <label
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "10px",
            alignItems: "center",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={state.rgpdAcepted}
            onChange={(e) => onRgpdChange(e.target.checked)}
          />
          <Typography variant="caption">
            Acepto la política de privacidad y el envío de datos.
          </Typography>
        </label>
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!todoOk || isSubmitting || !state.rgpdAcepted}
          fullWidth
        >
          {isSubmitting ? "Enviando..." : "Finalizar Check-in"}
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. ÉXITO
// ═══════════════════════════════════════════════════════════════════════════
interface ExitoProps {
  state: CheckinState;
  onAddHora?: () => void;
}

export const ScreenExito: React.FC<ExitoProps> = ({ state, onAddHora }) => {
  const { reserva, guests, horaLlegada } = state;
  const main = guests[0] ?? {};
  const nombreCompleto = [main.nombre, main.apellido].filter(Boolean).join(" ");

  return (
    <div className="success-wrap">
      <div className="success-ring">
        <Icon name="checkC" size={42} color="var(--ok)" />
      </div>

      <Typography
        variant="h1"
        className="success-title"
        sx={{
          fontFamily: "Cormorant Garamond, serif",
          fontSize: "2rem",
          textAlign: "center",
          my: 2,
        }}
      >
        ¡Registro completado!
      </Typography>

      <p
        className="success-sub"
        style={{ textAlign: "center", marginBottom: 24 }}
      >
        Sus datos han sido enviados. Le esperamos en recepción.
      </p>

      <div className="success-info-card">
        {reserva && (
          <>
            <div className="si-row">
              <span>Reserva</span>
              <span>{reserva.confirmacion}</span>
            </div>
            <div className="si-row">
              <span>Habitación</span>
              <span>{reserva.habitacion}</span>
            </div>
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "8px 0",
              }}
            />
          </>
        )}
        <div className="si-row">
          <span>Titular</span>
          <span>{nombreCompleto}</span>
        </div>
        <div className="si-row">
          <span>Llegada</span>
          <span>{horaLlegada || "No especificada"}</span>
        </div>
      </div>

      <Box
        sx={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          mt: 3,
        }}
      >
        <Button
          variant="primary"
          style={{ background: "var(--secondary)" }}
          onClick={() => window.print()}
        >
          <Icon name="check" size={16} /> Guardar confirmación
        </Button>

        {(!horaLlegada || horaLlegada === "No especificada") && (
          <Button variant="secondary" iconLeft="clock" onClick={onAddHora}>
            Añadir hora de llegada
          </Button>
        )}
      </Box>
    </div>
  );
};
