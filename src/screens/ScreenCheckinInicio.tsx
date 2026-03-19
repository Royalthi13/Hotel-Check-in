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
  // ✅ PRO FIX: Ahora acepta que la reserva sea null o undefined
  reserva?: Reserva | null;
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

  const legalSections = t("legal.sections", { returnObjects: true });
  const sectionsArray = Array.isArray(legalSections)
    ? (legalSections as LegalSection[])
    : [];

  // ✅ PRO FIX: Valores por defecto seguros si 'reserva' llega como null
  const confirmacion = reserva?.confirmacion || "---";
  const numHuespedes = reserva?.numHuespedes || 1;
  const fEntrada = reserva?.fechaEntrada || "---";
  const fSalida = reserva?.fechaSalida || "---";

  const title1 = t("welcome.title_new_1");
  const title2 = t("welcome.title_new_2");

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 4 },
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      <div className="sec-hdr" style={{ padding: 0 }}>
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
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ fontWeight: 600 }}
        >
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
            <strong>{t("welcome.reservation")}:</strong> {confirmacion}
          </Typography>
          <Typography variant="body2">
            <strong>{t("welcome.guests_booked")}:</strong> {numHuespedes}
          </Typography>
        </Box>

        <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Icon name="calendar" size={14} color="var(--primary)" />
          <Typography
            variant="body2"
            sx={{ color: "var(--text-mid)", fontWeight: 500 }}
          >
            {fEntrada} — {fSalida}
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
              display: "flex",
              alignItems: "center",
              gap: "4px",
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
