import React from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@/components/ui";
import { useCheckinContext } from "@/context/useCheckinContext";

export const ScreenHuespedIntermedio: React.FC = () => {
  const { nav, actions, handlePartialSubmit } = useCheckinContext();
  const { t } = useTranslation();

  return (
    <div
      className="step-container"
      style={{ textAlign: "center", padding: "40px var(--px)" }}
    >
      <div
        className="success-ring"
        style={{ margin: "0 auto 24px", borderColor: "var(--primary)" }}
      >
        <Icon name="checkC" size={42} color="var(--primary)" />
      </div>

      <div className="sec-hdr" style={{ marginBottom: "32px" }}>
        <h2
          style={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "28px",
            marginBottom: "12px",
          }}
        >
          {t("huesped_intermedio.title")}
        </h2>
        <p style={{ color: "var(--text-mid)", lineHeight: 1.6 }}>
          {t("huesped_intermedio.subtitle")}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          maxWidth: "400px",
          margin: "0 auto",
        }}
      >
        <Button
          variant="primary"
          iconRight="right"
          onClick={() =>
            actions.nextGuest(nav.guestIndex, "huesped_intermedio")
          }
        >
          {t("huesped_intermedio.btn_continue")}
        </Button>
        <Button variant="secondary" onClick={handlePartialSubmit}>
          {t("huesped_intermedio.btn_link")}
        </Button>
      </div>
    </div>
  );
};
