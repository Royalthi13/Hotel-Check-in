import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Alert, Icon } from "@/components/ui";
import { PARENTESCOS_MENOR } from "@/constants";
import type { PartialGuestData } from "@/types";
import { Checkbox, FormControlLabel, FormGroup } from "@mui/material";

type AdultoData = PartialGuestData & { originalIndex: number };

interface Props {
  menor: PartialGuestData;
  adultos: AdultoData[];
  onRelacionChange: (adultoIndex: number, parentesco: string) => void;
  onNext: () => void;
  onPartialSave?: () => void;
  hasNextMinor?: boolean;
  isSubmitting?: boolean;
}

function nombreAdulto(adulto: PartialGuestData, t: TFunction): string {
  const nombre = [adulto.nombre, adulto.apellido].filter(Boolean).join(" ");
  return nombre || t("minors.adult_fallback", { count: 1 });
}

function nombreMenor(menor: PartialGuestData, t: TFunction): string {
  const nombre = [menor.nombre, menor.apellido].filter(Boolean).join(" ");
  return nombre || t("minors.minor_fallback", { count: 1 });
}

export const ScreenRelacionesMenor: React.FC<Props> = ({
  menor,
  adultos,
  onRelacionChange,
  onNext,
  onPartialSave,
  hasNextMinor,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  const relaciones = menor.relacionesConAdultos ?? [];

  // 🔥 Mantenemos en memoria qué adultos hemos marcado que duermen en la misma habitación
  const [adultosEnHabitacion, setAdultosEnHabitacion] = useState<number[]>(
    relaciones.map((r) => r.adultoIndex),
  );

  const toggleAdult = (idx: number) => {
    setAdultosEnHabitacion((prev) => {
      if (prev.includes(idx)) {
        onRelacionChange(idx, ""); // Si lo desmarcamos, borramos el parentesco
        return prev.filter((i) => i !== idx);
      } else {
        return [...prev, idx];
      }
    });
  };

  const errorSinAdultos = touched && adultosEnHabitacion.length === 0;

  // Verificamos que todos los adultos marcados tengan un parentesco elegido
  const todosRellenos =
    adultosEnHabitacion.length > 0 &&
    adultosEnHabitacion.every((idx) => {
      const rel = relaciones.find((r) => r.adultoIndex === idx);
      return rel && rel.parentesco.trim() !== "";
    });

  const handleNext = () => {
    setTouched(true);
    if (todosRellenos) onNext();
  };

  const handlePartial = () => {
    setTouched(true);
    if (todosRellenos && onPartialSave) onPartialSave();
  };

  const nombreDelMenor = nombreMenor(menor, t);

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>{t("minors.relationship_title")}</h2>
        <p>
          {t("minors.declare_relationship_room", {
            defaultValue: `Indique qué adultos duermen en la misma habitación que ${nombreDelMenor} y cuál es su parentesco.`,
          })}
        </p>
      </div>

      <div style={{ padding: "8px 24px 0" }}>
        <Alert variant="warm" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14} />
          <span>
            <strong>{t("minors.legal_warning_title")}</strong>
            {t("minors.legal_warning_text")}
          </span>
        </Alert>

        {/* 🔥 PASO 1: Checkboxes para seleccionar adultos en la habitación */}
        <div
          style={{
            marginBottom: 24,
            padding: "16px",
            background: "var(--bg)",
            borderRadius: 12,
            border: `1.5px solid ${errorSinAdultos ? "var(--err)" : "var(--border)"}`,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            ¿Qué adultos duermen en la misma habitación?
          </div>
          <FormGroup>
            {adultos.map((adulto) => (
              <FormControlLabel
                key={adulto.originalIndex}
                control={
                  <Checkbox
                    checked={adultosEnHabitacion.includes(adulto.originalIndex)}
                    onChange={() => toggleAdult(adulto.originalIndex)}
                    size="small"
                    sx={{
                      color: "var(--primary)",
                      "&.Mui-checked": { color: "var(--primaryD)" },
                    }}
                  />
                }
                label={
                  <span style={{ fontSize: 14 }}>
                    {nombreAdulto(adulto, t)}
                  </span>
                }
              />
            ))}
          </FormGroup>
          {errorSinAdultos && (
            <span
              className="field-err"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 4,
              }}
            >
              <Icon name="warn" size={11} />{" "}
              {t("validation.min_adults", {
                defaultValue: "Debe seleccionar al menos un adulto.",
              })}
            </span>
          )}
        </div>

        {/* 🔥 PASO 2: Desplegables de parentesco SOLO para los adultos marcados */}
        {adultosEnHabitacion.map((realIdx) => {
          const adulto = adultos.find((a) => a.originalIndex === realIdx);
          if (!adulto) return null;

          const relacionActual =
            relaciones.find((r) => r.adultoIndex === realIdx)?.parentesco ?? "";
          const sinRelacion = touched && relacionActual.trim() === "";

          return (
            <div
              key={realIdx}
              style={{
                marginBottom: 16,
                padding: "16px",
                background: "var(--bg)",
                borderRadius: 12,
                border: `1.5px solid ${sinRelacion ? "var(--err)" : "var(--border)"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "var(--secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="user" size={18} color="#fff" />
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text)",
                    }}
                  >
                    {nombreAdulto(adulto, t)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-low)" }}>
                    {realIdx === 0
                      ? t("minors.booking_holder")
                      : t("minors.adult_fallback", { count: realIdx + 1 })}
                  </div>
                </div>
              </div>

              <div className="field">
                <label>
                  {t("minors.relation_with", { name: nombreDelMenor })}
                  <span style={{ color: "var(--primary)", marginLeft: 2 }}>
                    *
                  </span>
                </label>
                <select
                  value={relacionActual}
                  onChange={(e) => onRelacionChange(realIdx, e.target.value)}
                  className={sinRelacion ? "err" : ""}
                  style={{ height: 46 }}
                >
                  <option value="">{t("minors.select_relationship")}</option>
                  {PARENTESCOS_MENOR.map((p) => (
                    <option key={p} value={p}>
                      {t(`constants.parentescos.${p}`)}
                    </option>
                  ))}
                </select>
                {sinRelacion && (
                  <span
                    className="field-err"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                    }}
                  >
                    <Icon name="warn" size={11} />{" "}
                    {t("minors.mandatory_legal_field")}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="spacer" />
      <div
        className="btn-row"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {/* 🔥 Botón "Guardar" para Menores si hay más menores detrás de este */}
        {hasNextMinor && onPartialSave && (
          <Button
            variant="secondary"
            onClick={handlePartial}
            disabled={isSubmitting}
            style={{ flex: 1, minWidth: "200px" }}
          >
            {isSubmitting
              ? "..."
              : t("common.save_partial", {
                  defaultValue: "Guardar y seguir luego",
                })}
          </Button>
        )}
        <Button
          variant="primary"
          iconRight="right"
          onClick={handleNext}
          disabled={isSubmitting}
          style={{ flex: 1, minWidth: "200px" }}
        >
          {isSubmitting ? "..." : t("common.continue")}
        </Button>
      </div>
    </div>
  );
};
