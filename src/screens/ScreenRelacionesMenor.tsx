import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import type { TFunction } from "i18next"; // Tipado para pasarlo a las funciones
import { Button, Alert, Icon } from "@/components/ui";
import { PARENTESCOS_MENOR } from "@/constants";
import type { PartialGuestData } from "@/types";

interface Props {
  // El menor cuyos parentescos se están declarando
  menor: PartialGuestData;
  menorIndex: number; // relativo (0 = primer menor)
  menorRealIndex: number; // absoluto en el array guests

  // Los adultos del grupo
  adultos: PartialGuestData[];

  // Callback cuando cambia un parentesco
  onRelacionChange: (adultoIndex: number, parentesco: string) => void;

  onNext: () => void;
}

// 2. Añadimos 't' a los parámetros para traducir los fallbacks
function nombreAdulto(
  adulto: PartialGuestData,
  idx: number,
  t: TFunction,
): string {
  const nombre = [adulto.nombre, adulto.apellido].filter(Boolean).join(" ");
  return nombre || t("minors.adult_fallback", { count: idx + 1 });
}

function nombreMenor(
  menor: PartialGuestData,
  idx: number,
  t: TFunction,
): string {
  const nombre = [menor.nombre, menor.apellido].filter(Boolean).join(" ");
  return nombre || t("minors.minor_fallback", { count: idx + 1 });
}

export const ScreenRelacionesMenor: React.FC<Props> = ({
  menor,
  menorIndex,
  adultos,
  onRelacionChange,
  onNext,
}) => {
  const { t } = useTranslation(); // 3. Inicializamos el traductor
  const [touched, setTouched] = useState(false);

  // Verificar que todos los parentescos están rellenos
  const relaciones = menor.relacionesConAdultos ?? [];
  const todosRellenos =
    relaciones.length === adultos.length &&
    relaciones.every((r) => r.parentesco.trim() !== "");

  const handleNext = () => {
    setTouched(true);
    if (todosRellenos) onNext();
  };

  const nombreDelMenor = nombreMenor(menor, menorIndex, t);

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>{t("minors.relationship_title")}</h2>
        <p>
          {t("minors.declare_relationship_1")}
          <strong>{nombreDelMenor}</strong>
          {t("minors.declare_relationship_2")}
        </p>
      </div>

      <div style={{ padding: "8px 24px 0" }}>
        {/* Aviso legal */}
        <Alert variant="warm" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14} />
          <span>
            <strong>{t("minors.legal_warning_title")}</strong>
            {t("minors.legal_warning_text")}
          </span>
        </Alert>

        {/* Un select por cada adulto */}
        {adultos.map((adulto, ai) => {
          const relacionActual =
            relaciones.find((r) => r.adultoIndex === ai)?.parentesco ?? "";
          const sinRelacion = touched && relacionActual.trim() === "";

          return (
            <div
              key={ai}
              style={{
                marginBottom: 16,
                padding: "16px",
                background: "var(--bg)",
                borderRadius: 12,
                border: `1.5px solid ${sinRelacion ? "var(--err)" : "var(--border)"}`,
              }}
            >
              {/* Cabecera del adulto */}
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
                    {nombreAdulto(adulto, ai, t)}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-low)" }}>
                    {ai === 0
                      ? t("minors.booking_holder")
                      : t("minors.adult_fallback", { count: ai + 1 })}
                  </div>
                </div>
              </div>

              {/* Select de parentesco */}
              <div className="field">
                <label>
                  {t("minors.relation_with", { name: nombreDelMenor })}
                  <span style={{ color: "var(--primary)", marginLeft: 2 }}>
                    *
                  </span>
                </label>
                <select
                  value={relacionActual}
                  onChange={(e) => onRelacionChange(ai, e.target.value)}
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
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
};
