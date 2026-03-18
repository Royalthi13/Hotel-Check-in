import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon } from "@/components/ui";
import {
  Typography,
  Box,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Divider,
} from "@mui/material";
import type { Reserva } from "@/types";

interface Props {
  reserva: Reserva;
  onNext: (hayMenores: boolean) => void;
}

interface LegalSection {
  h: string;
  p: string;
}

export const ScreenCheckinInicio: React.FC<Props> = ({ reserva, onNext }) => {
  const { t } = useTranslation();
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [hayMenores, setHayMenores] = useState<string | null>(null);

  const legalSections = t("legal.sections", {
    returnObjects: true,
  }) as LegalSection[];
  const sectionsArray = Array.isArray(legalSections) ? legalSections : [];

  const reservaData = reserva as unknown as Record<string, unknown>;

  // 🔥 TRADUCCIÓN ROBUSTA: Usa tu clave "title_new_1" de es.json, o si no existe, extrae la primera palabra de "title"
  const title1 = t("welcome.title_new_1", {
    defaultValue: t("welcome.title").split(" ")[0],
  });
  const title2 = t("welcome.title_new_2", {
    defaultValue: t("welcome.title").split(" ").slice(1).join(" "),
  });

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div className="sec-hdr">
        <Typography
          variant="h4"
          sx={{ fontFamily: "Cormorant Garamond, serif", mb: 1 }}
        >
          {title1} <span style={{ color: "var(--primary)" }}>{title2}</span>
        </Typography>
      </div>

      <Box
        sx={{
          p: 2,
          bgcolor: "rgba(0,0,0,0.03)",
          borderRadius: "12px",
          border: "1px solid var(--border)",
        }}
      >
        <Typography variant="overline" color="text.secondary">
          {t("welcome.summary_title")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 1,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Typography variant="body2">
            <strong>{t("welcome.reservation")}:</strong>{" "}
            {(reservaData.localizador as string) ||
              (reservaData.id as string) ||
              (reservaData.confirmacion as string) ||
              "---"}
          </Typography>
          <Typography variant="body2">
            <strong>{t("welcome.guests_booked")}:</strong>{" "}
            {reserva.numHuespedes}
          </Typography>
        </Box>
        <Typography
          variant="caption"
          sx={{
            display: "block",
            mt: 2,
            color: "var(--text-low)",
            fontStyle: "italic",
          }}
        >
          {t("welcome.error_notice")}
        </Typography>
      </Box>

      <FormControl component="fieldset">
        <FormLabel
          sx={{
            color: "var(--text)",
            fontWeight: "bold",
            mb: 1,
            fontSize: "0.9rem",
          }}
        >
          {t("welcome.question_minors")}
        </FormLabel>
        <RadioGroup
          row
          value={hayMenores}
          onChange={(e) => setHayMenores(e.target.value)}
        >
          <FormControlLabel
            value="no"
            control={<Radio size="small" />}
            label={t("common.no")}
          />
          <FormControlLabel
            value="yes"
            control={<Radio size="small" />}
            label={t("common.yes")}
          />
        </RadioGroup>
      </FormControl>

      <Divider />

      <Box
        sx={{
          maxHeight: "150px",
          overflowY: "auto",
          p: 2,
          bgcolor: "#fcfcfc",
          border: "1px solid #eee",
          borderRadius: "8px",
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: "bold" }}>
          {t("legal.title")}
        </Typography>
        <Typography variant="caption" sx={{ display: "block", mb: 2 }}>
          {t("legal.intro")}
        </Typography>

        {sectionsArray.map((section, idx) => (
          <Box key={idx} sx={{ mb: 2 }}>
            <Typography
              variant="caption"
              sx={{ fontWeight: "bold", display: "block" }}
            >
              {section.h}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {section.p}
            </Typography>
          </Box>
        ))}

        <Typography variant="caption" sx={{ fontStyle: "italic" }}>
          {t("legal.footer")}
        </Typography>
      </Box>

      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            gap: 1,
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={acceptedLegal}
                onChange={(e) => setAcceptedLegal(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption">
                {t("legal.accept_check")}
              </Typography>
            }
          />
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              border: "none",
              background: "none",
              cursor: "pointer",
              color: "var(--primary)",
              fontSize: "0.75rem",
            }}
          >
            <Icon name="upload" size={12} /> {t("legal.download_btn")}
          </button>
        </Box>

        <Button
          disabled={!acceptedLegal || hayMenores === null}
          onClick={() => onNext(hayMenores === "yes")}
          iconRight="right"
        >
          {t("welcome.start_btn")}
        </Button>
      </Box>
    </Box>
  );
};
