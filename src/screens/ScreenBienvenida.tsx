import React from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import { Icon, ReservationCard } from "@/components/ui";
import type { Reserva, GuestData } from "@/types";
import "@/screens/ScreenBienvenida.css";

interface Props {
  knownGuest: GuestData | null;
  reserva: Reserva | null;
  onChooseScan: () => void;
  onChooseManual: () => void;
}

export const ScreenBienvenida: React.FC<Props> = ({
  knownGuest,
  reserva,
  onChooseScan,
  onChooseManual,
}) => {
  const { t } = useTranslation(); // 2. Inicializamos el traductor
  const isKnown = !!knownGuest;

  return (
    <>
      <div className="hero">
        <div className="hero-eyebrow">{t("welcome.eyebrow")}</div>
        <h1 className="hero-title">
          {isKnown ? (
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
          )}
        </h1>
        {isKnown && knownGuest?.nombre && (
          <p
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 20,
              fontWeight: 400,
              color: "#fff",
              marginTop: 10,
            }}
          >
            {/* 3. Interpolación de variables. Le pasamos el nombre al diccionario */}
            {t("welcome.greeting", { name: knownGuest.nombre })}
          </p>
        )}
        <p className="hero-subtitle">
          {isKnown ? t("welcome.subtitle_known") : t("welcome.subtitle_new")}
        </p>
      </div>

      {reserva && (
        <div style={{ padding: "18px 24px 0" }}>
          <ReservationCard reserva={reserva} />
        </div>
      )}

      <div style={{ padding: "20px 24px 0" }}>
        <p
          style={{
            fontSize: 13,
            color: "var(--text-mid)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          {isKnown ? t("welcome.how_to_review") : t("welcome.how_to_complete")}
        </p>

        <div className="choice-grid">
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
                {isKnown
                  ? t("welcome.card_manual_title_known")
                  : t("welcome.card_manual_title_new")}
              </div>
              <div className="choice-card-sub">
                {isKnown
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
