import React from "react";
import { Typography } from "@mui/material";
import { Button } from "@/components/ui";
import type { CheckinState } from "@/types";

export const ScreenRevision: React.FC<{
  state: CheckinState;
  isSubmitting: boolean;
  onEditGuest: (index: number) => void;
  onSubmit: () => void;
  onRgpdChange: (v: boolean) => void;
}> = ({ state, isSubmitting, onEditGuest, onSubmit, onRgpdChange }) => {
  const infoGrupo = Array.from({ length: state.numPersonas }).map((_, i) => {
    const g = state.guests[i];
    const esValido = !!(g?.nombre && g?.numDoc);
    return {
      index: i,
      nombre: g?.nombre || Huésped ${i + 1},
      esValido,
    };
  });

  const pendientes = infoGrupo.filter((h) => !h.esValido);
  const totalListos = infoGrupo.filter((h) => h.esValido).length;
  const todoOk = totalListos === state.numPersonas;

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
          Resumen del Check-in
        </Typography>
        <p>
          {todoOk
            ? "✓ Todos los huéspedes están listos."
            : Faltan datos de ${pendientes.length} personas por completar.}
        </p>
      </div>

      <div
        style={{
          padding: "0 24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {/* INDICADOR DE PROGRESO REAL */}
        <div
          style={{
            background: "var(--border)",
            height: "8px",
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: ${(totalListos / state.numPersonas) * 100}%,
              height: "100%",
              background: todoOk ? "var(--ok)" : "var(--primary)",
              transition: "width 0.3s ease",
            }}
          />
        </div>

        {/* LISTA DINÁMICA DE HUÉSPEDES */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {infoGrupo.map((h) => (
            <div
              key={h.index}
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid",
                borderColor: h.esValido ? "var(--border)" : "var(--err)",
                backgroundColor: h.esValido ? "#fff" : "#fff5f5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <Typography variant="subtitle2" style={{ fontWeight: 700 }}>
                  {h.nombre}
                </Typography>
                <span
                  style={{
                    fontSize: "12px",
                    color: h.esValido ? "var(--ok)" : "var(--err)",
                  }}
                >
                  {h.esValido
                    ? "✓ Datos completos"
                    : "⚠ Faltan datos obligatorios"}
                </span>
              </div>

              <Button
                variant="secondary"
                onClick={() => onEditGuest(h.index)}
                style={{ padding: "4px 12px", fontSize: "11px" }}
              >
                {h.esValido ? "Revisar" : "Completar"}
              </Button>
            </div>
          ))}
        </div>

        {/* RGPD */}
        <label
          className="checkbox-label"
          style={{
            display: "flex",
            gap: "12px",
            marginTop: "10px",
            alignItems: "center",
          }}
        >
          <input
            type="checkbox"
            onChange={(e) => onRgpdChange(e.target.checked)}
          />
          <span style={{ fontSize: "12px" }}>
            Acepto la política de privacidad y envío de datos.
          </span>
        </label>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          variant="primary"
          onClick={onSubmit}
          disabled={!todoOk || isSubmitting || !state.rgpdAcepted}
          fullWidth
        >
          {isSubmitting ? "Enviando..." : "Confirmar registro de todo el grupo"}
        </Button>
      </div>
    </div>
  );
};