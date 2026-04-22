import React from "react";
import { useTranslation } from "react-i18next";
import { Icon, ReservationCard } from "@/components/ui";
import type { Reserva, GuestData } from "@/types";
import "@/screens/ScreenBienvenida.css";

interface Props {
  knownGuest: GuestData | null;
  reserva: Reserva | null;
  guestIndex?: number;
  onChooseScan: () => void;
  onChooseManual: () => void;
}

export const ScreenBienvenida: React.FC<Props> = ({
  knownGuest,
  reserva,
  guestIndex = 0,
  onChooseScan,
  onChooseManual,
}) => {
  const { t } = useTranslation();
  const isKnown = !!knownGuest;

  const isTitular = guestIndex === 0;

  return (
    <>
      <div className="hero">
        <div className="hero-eyebrow">
          {/* ✅ Usamos clave de i18n para la cejilla */}
          {isTitular ? t("welcome.eyebrow") : t("welcome.next_step")}
        </div>

        <h1 className="hero-title">
          {isTitular ? (
            isKnown ? (
              <>
                {t("welcome.title_known_1")}
                <br />
                <em>{t("welcome.title_known_2")}</em>
              </>
            ) : (
              <>
                {t("welcome.title_new_1")}
                <br />
                <em>{t("welcome.title_new_2")}</em>
              </>
            )
          ) : (
            <>
              {/* ✅ Pasamos el índice dinámico al traductor */}
              {t("welcome.guest_data_1")} <br />
              <em>{t("welcome.guest_data_2", { index: guestIndex + 1 })}</em>
            </>
          )}
        </h1>

        {isTitular && isKnown && knownGuest?.nombre && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 20,
              fontWeight: 400,
              color: "#fff",
              marginTop: 10,
            }}
          >
            {t("welcome.greeting", { name: knownGuest.nombre })}
          </p>
        )}

        <p className="hero-subtitle">
          {/* ✅ Subtítulo del acompañante por i18n */}
          {isTitular
            ? isKnown
              ? t("welcome.subtitle_known")
              : t("welcome.subtitle_new")
            : t("welcome.companion_subtitle")}
        </p>
      </div>

      {reserva && (
        <div style={{ padding: "18px var(--px) 0" }}>
          <ReservationCard reserva={reserva} />
        </div>
      )}

      <div
        style={{
          padding: "32px 24px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <h3
          style={{
            fontSize: "var(--fs-lg)",
            fontWeight: 600,
            color: "var(--text)",
            textAlign: "center",
            marginBottom: "24px",
            letterSpacing: "-0.01em",
          }}
        >
          {/* ✅ Pregunta del acompañante por i18n */}
          {isTitular
            ? isKnown
              ? t("welcome.how_to_review")
              : t("welcome.how_to_complete")
            : t("welcome.how_to_companion")}
        </h3>

        <div
          className="choice-grid"
          style={{
            padding: 0,
            width: "100%",
            maxWidth: "700px",
          }}
        >
          <button className="choice-card" onClick={onChooseScan}>
            <div className="choice-icon accent">
              <Icon name="id" size={20} color="#fff" />
            </div>
            <div className="choice-card-body">
              <div className="choice-card-title">
                {t("welcome.card_scan_title")}
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 10,
                    fontWeight: 600,
                    background: "var(--primary-lt)",
                    color: "var(--primary-d)",
                    padding: "2px 7px",
                    borderRadius: 20,
                    verticalAlign: "middle",
                  }}
                >
                  {t("common.optional")}
                </span>
              </div>
              <div className="choice-card-sub">
                {t("welcome.card_scan_sub")}
              </div>
            </div>
          </button>

          <button className="choice-card" onClick={onChooseManual}>
            <div className="choice-icon">
              <Icon name="user" size={20} color="#fff" />
            </div>
            <div className="choice-card-body">
              <div className="choice-card-title">
                {isTitular && isKnown
                  ? t("welcome.card_manual_title_known")
                  : t("welcome.card_manual_title_new")}
              </div>
              <div className="choice-card-sub">
                {isTitular && isKnown
                  ? t("welcome.card_manual_sub_known")
                  : t("welcome.card_manual_sub_new")}
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="spacer" />
      <div className="privacy" style={{ paddingBottom: 24 }}>
        <Icon name="lock" size={11} />
        {t("common.privacy_ssl")}
      </div>
    </>
  );
};
