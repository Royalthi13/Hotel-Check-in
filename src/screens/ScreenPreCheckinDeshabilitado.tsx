import React from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import { Button, Icon, Alert } from "@/components/ui";
import { Typography, Box } from "@mui/material";

interface Props {
  motivo?: string;
  onBack: () => void;
}

export const ScreenPrecheckinDeshabilitado: React.FC<Props> = ({
  motivo,
  onBack,
}) => {
  const { t } = useTranslation(); // 2. Inicializamos el traductor

  return (
    <div
      className="screen"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box sx={{ p: 4 }}>
        <div
          style={{
            backgroundColor: "var(--primary-lt)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Icon name="lock" size={40} color="var(--primary)" />
        </div>

        <Typography
          variant="h4"
          sx={{ fontFamily: "Cormorant Garamond, serif", mb: 2 }}
        >
          {t("disabled.title")}
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, lineHeight: 1.6 }}
        >
          {/* Si el backend manda un motivo específico, lo mostramos. Si no, usamos el genérico traducido */}
          {motivo || t("disabled.default_reason")}
          <br />
          <br />
          {/* Usamos el texto de instrucción */}
          {t("disabled.instruction_1")}{" "}
          <strong>{t("disabled.instruction_bold")}</strong>{" "}
          {t("disabled.instruction_2")}
        </Typography>

        <div style={{ textAlign: "left", marginBottom: 32 }}>
          <Alert variant="info">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>{t("disabled.li_1")}</li>
              <li>{t("disabled.li_2")}</li>
              <li>{t("disabled.li_3")}</li>
            </ul>
          </Alert>
        </div>

        <Button variant="secondary" onClick={onBack}>
          {t("common.back_home")}
        </Button>
      </Box>
    </div>
  );
};
