import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button, Alert } from "@/components/ui";
import { getRelationships } from "@/api/catalogs.service";
import type { PartialGuestData, RelacionDB } from "@/types";
import {
  Box,
  Typography,
  Paper,
  Checkbox,
  FormControl,
  Select,
  MenuItem,
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

  // --- MAGIA DE LA API: Guardamos aquí la lista de la base de datos ---
  const [listaRelaciones, setListaRelaciones] = useState<RelacionDB[]>([]);

  useEffect(() => {
    const cargarRelaciones = async () => {
      try {
        const datos = await getRelationships();
        setListaRelaciones(datos);
      } catch (error) {
        console.error("Error al cargar las relaciones de la BD:", error);
      }
    };
    cargarRelaciones();
  }, []);
  // ----------------------------------------------------------------------

  const [expandedIds, setExpandedIds] = useState<number[]>(() => {
    const adultosValidosIds = adultos.map((a) => a.originalIndex);
    const relacionesPreviasReales = (menor.relacionesConAdultos || [])
      .filter((r) => adultosValidosIds.includes(r.adultoIndex))
      .map((r) => r.adultoIndex);

    if (relacionesPreviasReales.length > 0) return relacionesPreviasReales;
    if (adultos.length === 1) return [adultos[0].originalIndex];
    return [];
  });

  const tieneNombre = menor.nombre || menor.apellido;
  const nombreMenor = tieneNombre
    ? [menor.nombre, menor.apellido].filter(Boolean).join(" ")
    : t("minors.this_minor", "este/a menor");
  const relaciones = menor.relacionesConAdultos ?? [];

  const toggleAdulto = (idx: number) => {
    if (expandedIds.includes(idx)) {
      setExpandedIds((prev) => prev.filter((id) => id !== idx));
      onRelacionChange(idx, "");
    } else {
      setExpandedIds((prev) => [...prev, idx]);
    }
  };

  const esValido =
    expandedIds.length > 0 &&
    expandedIds.every((id) => {
      const relacion = relaciones.find((r) => r.adultoIndex === id);
      return relacion && relacion.parentesco !== "";
    });

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <Box className="sec-hdr" sx={{ p: { xs: 2, sm: 3 }, pb: 0 }}>
        <Typography
          variant="h2"
          sx={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "var(--fs-2xl)",
            mb: 1,
            color: "var(--text)",
          }}
        >
          {t("minors.relationship_title", "Tutoría de Menores")}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: "var(--fs-sm)" }}
        >
          {t("minors.declare_relationship_1", "Declare la relación con ")}
          <strong>{nombreMenor}</strong>
          {t("minors.declare_relationship_2", " con cada adulto del grupo.")}
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1 }}>
        <Alert variant="warm" style={{ marginBottom: 20 }}>
          <strong>{t("minors.legal_warning_title", "Aviso Legal: ")}</strong>
          {t(
            "minors.legal_warning_text",
            "Todo menor debe estar vinculado a un adulto responsable de la reserva.",
          )}
        </Alert>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {adultos.map((adulto) => {
            const isSelected = expandedIds.includes(adulto.originalIndex);
            const parentesco =
              relaciones.find((r) => r.adultoIndex === adulto.originalIndex)
                ?.parentesco || "";
            const nombreAdulto =
              [adulto.nombre, adulto.apellido].filter(Boolean).join(" ") ||
              (adulto.originalIndex === 0
                ? t("common.main_guest", "Titular de la Reserva")
                : t("forms.adult_tag", "Acompañante Adulto"));

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
                  bgcolor: isSelected ? "var(--primary-lt)" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
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
                      sx={{
                        fontWeight: 600,
                        lineHeight: 1.2,
                        color: "var(--text)",
                      }}
                    >
                      {nombreAdulto}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {adulto.originalIndex === 0
                        ? t("common.main_guest", "Huésped Principal")
                        : t("forms.adult_tag", "Adulto")}
                    </Typography>
                  </Box>
                </Box>

                {isSelected && (
                  <Box
                    sx={{
                      mt: 2,
                      pt: 2,
                      borderTop: "1px solid rgba(250,134,92,0.2)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 1,
                        backgroundColor: "rgba(255,255,255,0.7)",
                        p: 2,
                        borderRadius: "12px",
                      }}
                    >
                      <Typography
                        sx={{ color: "var(--text)", fontSize: "15px" }}
                      >
                        {t("minors.declare_adult_1", "Declaro que ")}
                        <strong>{nombreAdulto}</strong>
                        {t("minors.declare_adult_2", " actúa en calidad de")}
                      </Typography>

                      <FormControl
                        size="small"
                        sx={{ minWidth: 160, flexGrow: 1 }}
                      >
                        <Select
                          displayEmpty
                          value={parentesco || ""} // <-- El || "" es VITAL para que pille el placeholder
                          onChange={(e) =>
                            onRelacionChange(
                              adulto.originalIndex,
                              e.target.value,
                            )
                          }
                          sx={{
                            borderRadius: "8px",
                            bgcolor: "#fff",
                            fontWeight: 600,
                            color: parentesco
                              ? "var(--primary-d)"
                              : "var(--text-mid)",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: parentesco
                                ? "var(--primary)"
                                : "var(--border)",
                              borderWidth: "1.5px",
                            },
                            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                              borderColor: "var(--primary)",
                            },
                          }}
                        >
                          {/* EL PLACEHOLDER (Solo se ve si no hay nada seleccionado) */}
                          <MenuItem value="" disabled>
                            <em style={{ color: "gray" }}>
                              {t(
                                "minors.select_relationship",
                                "Seleccionar...",
                              )}
                            </em>
                          </MenuItem>

                          {/* LAS OPCIONES (Se traducen automáticamente con i18n) */}
                          {listaRelaciones.map((relacion) => (
                            <MenuItem
                              key={relacion.codrelation}
                              value={relacion.codrelation}
                            >
                              {t(
                                `parentescos.${relacion.codrelation}`,
                                relacion.name,
                              )}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <Typography
                        sx={{ color: "var(--text)", fontSize: "15px" }}
                      >
                        {t("common.of", "de ")}
                        <strong>{nombreMenor}</strong>.
                      </Typography>
                    </Box>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>

      <div className="spacer" />
      <Box
        className="btn-row"
        sx={{
          p: "12px var(--px) 28px",
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
        }}
      >
        {hasNextMinor && onPartialSave && (
          <Button
            variant="secondary"
            onClick={onPartialSave}
            disabled={isSubmitting}
            style={{ flex: 1, minWidth: "160px" }}
          >
            {t("common.save_partial", "Guardar y Pausar")}
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
          style={{ flex: 2, minWidth: "200px" }}
        >
          {t("common.continue", "Continuar")}
        </Button>
      </Box>
    </Box>
  );
};
