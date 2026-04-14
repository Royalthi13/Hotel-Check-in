import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, ReservationCard } from "@/components/ui";
import type { Reserva } from "@/types";

interface Props {
  reserva?: Reserva | null;
  onNext: (hayMenores: boolean) => void;
}

interface LegalSection {
  h: string;
  p: string;
}

export const ScreenCheckinInicio: React.FC<Props> = ({ reserva, onNext }) => {
  const { t } = useTranslation();

  const [legalOpen, setLegalOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false); // 🚨 Control de Errores Visuales

  const [acceptedLegal, setAcceptedLegal] = useState<boolean>(() => {
    return sessionStorage.getItem("lumina_acceptedLegal") === "true";
  });

  const [hayMenores, setHayMenores] = useState<string | null>(() => {
    return sessionStorage.getItem("lumina_hayMenores") || null;
  });

  useEffect(() => {
    const handleErrorEvent = () => setShowErrors(true);
    window.addEventListener("FORCE_VALIDATE", handleErrorEvent);
    return () => window.removeEventListener("FORCE_VALIDATE", handleErrorEvent);
  }, []);

  useEffect(() => {
    sessionStorage.setItem("lumina_acceptedLegal", String(acceptedLegal));
    window.dispatchEvent(new Event("LOCAL_STATE_CHANGED")); // Aviso al cerebro principal
    if (acceptedLegal) setShowErrors(false);
  }, [acceptedLegal]);

  useEffect(() => {
    if (hayMenores !== null) {
      sessionStorage.setItem("lumina_hayMenores", hayMenores);
      window.dispatchEvent(new Event("LOCAL_STATE_CHANGED")); // Aviso al cerebro principal
      setShowErrors(false);
    }
  }, [hayMenores]);

  const legalSections = t("legal.sections", { returnObjects: true });
  const sectionsArray = Array.isArray(legalSections)
    ? (legalSections as LegalSection[])
    : [];

  return (
    <div
      style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}
    >
      <div className="sec-hdr">
        <h2>
          {t("welcome.title_new_1")}{" "}
          <em style={{ color: "var(--primary)", fontStyle: "italic" }}>
            {t("welcome.title_new_2")}
          </em>
        </h2>
        <p>{t("appShell.subtitle")}</p>
      </div>

      <div
        style={{
          padding: "10px var(--px) 24px",
          display: "flex",
          flexDirection: "column",
          gap: "36px",
          flex: 1,
        }}
      >
        {reserva && (
          <div>
            <div
              className="divlabel"
              style={{ marginTop: 0, marginBottom: 16 }}
            >
              {t("welcome.summary_title")}
            </div>
            <ReservationCard reserva={reserva} />
            <p
              style={{
                fontSize: "var(--fs-xs)",
                color: "var(--text-low)",
                fontStyle: "italic",
                marginTop: "10px",
                lineHeight: 1.5,
              }}
            >
              {t("welcome.error_notice")}
            </p>
          </div>
        )}

        {/* 2. PREGUNTA DE MENORES */}
        <div>
          <div
            className="divlabel"
            style={{
              marginTop: 0,
              marginBottom: 16,
              color:
                showErrors && hayMenores === null ? "var(--error)" : "inherit",
            }}
          >
            {t("welcome.question_minors")}
            {showErrors && hayMenores === null && " *"}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px",
                borderRadius: "var(--r)",
                border: "1.5px solid",
                borderColor:
                  hayMenores === "no"
                    ? "var(--primary)"
                    : showErrors && hayMenores === null
                      ? "var(--error)"
                      : "var(--border)",
                background:
                  hayMenores === "no" ? "var(--primary-lt)" : "var(--white)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="minors"
                value="no"
                checked={hayMenores === "no"}
                onChange={(e) => setHayMenores(e.target.value)}
                style={{ display: "none" }}
              />
              <span
                style={{
                  fontSize: "var(--fs-md)",
                  fontWeight: hayMenores === "no" ? 600 : 400,
                  color:
                    hayMenores === "no"
                      ? "var(--primary-d)"
                      : showErrors && hayMenores === null
                        ? "var(--error)"
                        : "var(--text)",
                }}
              >
                {t("common.no")}
              </span>
            </label>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "14px",
                borderRadius: "var(--r)",
                border: "1.5px solid",
                borderColor:
                  hayMenores === "yes"
                    ? "var(--primary)"
                    : showErrors && hayMenores === null
                      ? "var(--error)"
                      : "var(--border)",
                background:
                  hayMenores === "yes" ? "var(--primary-lt)" : "var(--white)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <input
                type="radio"
                name="minors"
                value="yes"
                checked={hayMenores === "yes"}
                onChange={(e) => setHayMenores(e.target.value)}
                style={{ display: "none" }}
              />
              <span
                style={{
                  fontSize: "var(--fs-md)",
                  fontWeight: hayMenores === "yes" ? 600 : 400,
                  color:
                    hayMenores === "yes"
                      ? "var(--primary-d)"
                      : showErrors && hayMenores === null
                        ? "var(--error)"
                        : "var(--text)",
                }}
              >
                {t("common.yes")}
              </span>
            </label>
          </div>
        </div>

        {/* 3. CONDICIONES LEGALES Y CHECKBOX INTEGRADO */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <button
            type="button"
            onClick={() => setLegalOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-start",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              width: "100%",
              gap: 0,
            }}
          >
            <div className="divlabel" style={{ margin: 0, border: "none" }}>
              {t("legal.title")}
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              style={{
                marginLeft: 6,
                transition: "transform 0.25s ease",
                transform: legalOpen ? "rotate(180deg)" : "rotate(0deg)",
                color: "var(--primary)",
              }}
            >
              <path
                d="M3 5l5 5 5-5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {legalOpen && (
            <div
              style={{
                background: "var(--white)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r)",
                padding: "16px 20px",
                maxHeight: "200px",
                overflowY: "auto",
                fontSize: "13px",
                color: "var(--text-mid)",
                lineHeight: 1.6,
              }}
            >
              <p style={{ marginBottom: 12 }}>{t("legal.intro")}</p>
              {sectionsArray.map((section, idx) => (
                <div key={idx} style={{ marginBottom: 12 }}>
                  <strong
                    style={{
                      color: "var(--text)",
                      display: "block",
                      marginBottom: 2,
                    }}
                  >
                    {section.h}
                  </strong>
                  {section.p}
                </div>
              ))}
              <p
                style={{
                  marginTop: 12,
                  fontStyle: "italic",
                  color: "var(--text-low)",
                }}
              >
                {t("legal.footer")}
              </p>
            </div>
          )}

          {/* CHECKBOX BLINDADO CONTRA ERRORES */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "14px",
              padding: "16px",
              background: "var(--primary-lt)",
              border: "1px solid",
              borderColor:
                showErrors && !acceptedLegal
                  ? "var(--error)"
                  : "rgba(250, 134, 92, 0.25)",
              borderRadius: "var(--r)",
              cursor: "pointer",
              marginTop: "4px",
              transition: "border-color 0.3s ease",
            }}
          >
            <input
              type="checkbox"
              checked={acceptedLegal}
              onChange={(e) => setAcceptedLegal(e.target.checked)}
              style={{
                width: "20px",
                height: "20px",
                accentColor:
                  showErrors && !acceptedLegal
                    ? "var(--error)"
                    : "var(--primary)",
                flexShrink: 0,
                marginTop: "1px",
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color:
                  showErrors && !acceptedLegal ? "var(--error)" : "var(--text)",
                lineHeight: 1.4,
                transition: "color 0.3s ease",
              }}
            >
              {t("legal.accept_check")}
            </span>
          </label>
        </div>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          disabled={!acceptedLegal || hayMenores === null}
          onClick={() => onNext(hayMenores === "yes")}
          iconRight="right"
        >
          {t("welcome.start_btn")}
        </Button>
      </div>
    </div>
  );
};
