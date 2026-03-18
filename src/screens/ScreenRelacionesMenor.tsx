import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Button, Alert, Icon } from "@/components/ui";
import { PARENTESCOS_MENOR } from "@/constants";
import type { PartialGuestData } from "@/types";

// Extensión para saber el índice original en el array global
type AdultoData = PartialGuestData & { originalIndex: number };

interface Props {
  menor: PartialGuestData;
  adultos: AdultoData[];
  onRelacionChange: (adultoIndex: number, parentesco: string) => void;
  onNext: () => void;
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
}) => {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  const relaciones = menor.relacionesConAdultos ?? [];
  const todosRellenos =
    relaciones.length === adultos.length &&
    relaciones.every((r) => r.parentesco.trim() !== "");

  const handleNext = () => {
    setTouched(true);
    if (todosRellenos) onNext();
  };

  const nombreDelMenor = nombreMenor(menor, t);

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
        <Alert variant="warm" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14} />
          <span>
            <strong>{t("minors.legal_warning_title")}</strong>
            {t("minors.legal_warning_text")}
          </span>
        </Alert>

        {adultos.map((adulto) => {
          // Usamos el originalIndex para guardar el parentesco en el array real
          const realIdx = adulto.originalIndex;
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
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          {t("common.continue")}
        </Button>
      </div>
    </div>
  );
};
