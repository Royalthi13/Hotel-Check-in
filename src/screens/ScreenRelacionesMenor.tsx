import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Alert, Icon } from "@/components/ui";
import { PARENTESCOS_MENOR } from "@/constants";
import type { PartialGuestData } from "@/types";
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from "@mui/material";

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
  const nombreMenor =
    [menor.nombre, menor.apellido].filter(Boolean).join(" ") ||
    t("minors.minor_fallback", { count: 1 });

  const relaciones = menor.relacionesConAdultos ?? [];
  const adultosSeleccionadosIds = relaciones.map((r) => r.adultoIndex);

  const toggleAdulto = (idx: number) => {
    if (adultosSeleccionadosIds.includes(idx)) {
      onRelacionChange(idx, ""); // Al desmarcar, vaciamos parentesco
    } else {
      onRelacionChange(idx, "Hijo/a"); // Valor por defecto común para agilizar
    }
  };

  const esValido =
    adultosSeleccionadosIds.length > 0 &&
    relaciones.every((r) => r.parentesco !== "");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Box className="sec-hdr" sx={{ p: { xs: 2, sm: 3 }, pb: 0 }}>
        <Typography
          variant="h4"
          sx={{ fontFamily: "Cormorant Garamond, serif", mb: 1 }}
        >
          {t("minors.relationship_title")}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ¿Con qué adultos comparte habitación <strong>{nombreMenor}</strong>?
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1 }}>
        <Alert variant="warm" style={{ marginBottom: 20 }}>
          <Icon name="info" size={14} />
          <span>{t("minors.legal_warning_text")}</span>
        </Alert>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {adultos.map((adulto) => {
            const isSelected = adultosSeleccionadosIds.includes(
              adulto.originalIndex,
            );
            const parentesco =
              relaciones.find((r) => r.adultoIndex === adulto.originalIndex)
                ?.parentesco || "";

            return (
              <Paper
                key={adulto.originalIndex}
                elevation={isSelected ? 3 : 0}
                onClick={() => toggleAdulto(adulto.originalIndex)}
                sx={{
                  p: 2,
                  borderRadius: "16px",
                  border: "2px solid",
                  borderColor: isSelected
                    ? "var(--primary)"
                    : "var(--border-lt)",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                  bgcolor: isSelected ? "var(--primary-lt)" : "#fff",
                  "&:hover": { borderColor: "var(--primary)" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Checkbox
                    checked={isSelected}
                    sx={{
                      p: 0,
                      color: "var(--primary)",
                      "&.Mui-checked": { color: "var(--primary)" },
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="subtitle1"
                      sx={{ fontWeight: 600, lineHeight: 1.2 }}
                    >
                      {[adulto.nombre, adulto.apellido].join(" ")}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {adulto.originalIndex === 0
                        ? t("common.main_guest")
                        : t("forms.adult_tag")}
                    </Typography>
                  </Box>
                </Box>

                {isSelected && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: "1px solid rgba(0,0,0,0.05)",
                    }}
                    onClick={(e) => e.stopPropagation()} // Evita desmarcar al clickar el select
                  >
                    <FormControl fullWidth size="small">
                      <InputLabel id={`label-rel-${adulto.originalIndex}`}>
                        {t("minors.relationship_title")}
                      </InputLabel>
                      <Select
                        labelId={`label-rel-${adulto.originalIndex}`}
                        value={parentesco}
                        label={t("minors.relationship_title")}
                        onChange={(e) =>
                          onRelacionChange(adulto.originalIndex, e.target.value)
                        }
                        sx={{ borderRadius: "8px", bgcolor: "#fff" }}
                      >
                        {PARENTESCOS_MENOR.map((p) => (
                          <MenuItem key={p} value={p}>
                            {t(`constants.parentescos.${p}`)}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>

      <Box
        className="btn-row"
        sx={{
          p: 3,
          bgcolor: "rgba(255,255,255,0.8)",
          backdropFilter: "blur(10px)",
          borderTop: "1px solid var(--border-lt)",
          display: "flex",
          gap: 2,
        }}
      >
        {hasNextMinor && onPartialSave && (
          <Button
            variant="secondary"
            onClick={onPartialSave}
            disabled={isSubmitting}
            style={{ flex: 1 }}
          >
            {isSubmitting ? "..." : t("common.save_partial")}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => {
            setTouched(true);
            if (esValido) onNext();
          }}
          disabled={isSubmitting || (touched && !esValido)}
          iconRight="right"
          style={{ flex: 2 }}
        >
          {t("common.continue")}
        </Button>
      </Box>
    </Box>
  );
};
