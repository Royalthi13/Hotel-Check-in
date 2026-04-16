import React, { useState, useEffect, useMemo } from "react";
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
  const [listaRelaciones, setListaRelaciones] = useState<RelacionDB[]>([]);

  // 1. Cargar relaciones desde la API
  useEffect(() => {
    const cargarRelaciones = async () => {
      try {
        const datos = await getRelationships();
        setListaRelaciones(datos);
      } catch (error) {
        console.error("Error cargando relaciones:", error);
      }
    };
    cargarRelaciones();
  }, []);

  // 2. 🛡️ FILTRO ULTRA-SEGURO (No permitimos que un adulto sea descendiente o cónyuge)
  const relacionesFiltradas = useMemo(() => {
    // Códigos comunes para Hijo/Nieto/Cónyuge
    const codigosBloqueados = ["HJ", "NI", "HI", "CN", "CY", "CO"];

    return listaRelaciones.filter((r) => {
      const codigo = r.codrelation.toUpperCase();
      const nombre = r.name.toLowerCase();

      // Regla 1: No estar en la lista de códigos prohibidos
      const porCodigo = !codigosBloqueados.includes(codigo);

      // Regla 2: Por seguridad extra, si el nombre contiene "conyuge", "hijo" o "nieto", fuera.
      const porNombre =
        !nombre.includes("conyuge") &&
        !nombre.includes("hijo") &&
        !nombre.includes("nieto");

      return porCodigo && porNombre;
    });
  }, [listaRelaciones]);

  // Gestión de selección de adultos
  const [expandedIds, setExpandedIds] = useState<number[]>(() => {
    const adultosValidosIds = adultos.map((a) => a.originalIndex);
    const relacionesPrevias = (menor.relacionesConAdultos || [])
      .filter((r) => adultosValidosIds.includes(r.adultoIndex))
      .map((r) => r.adultoIndex);

    if (relacionesPrevias.length > 0) return relacionesPrevias;
    if (adultos.length === 1) return [adultos[0].originalIndex];
    return [];
  });

  const nombreMenor =
    [menor.nombre, menor.apellido].filter(Boolean).join(" ") ||
    t("minors.this_minor");
  const relacionesGuardadas = menor.relacionesConAdultos ?? [];

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
      const r = relacionesGuardadas.find((rel) => rel.adultoIndex === id);
      return r && r.parentesco !== "";
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
          {t("minors.relationship_title")}
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ fontSize: "var(--fs-sm)" }}
        >
          {t("minors.declare_relationship_1")} <strong>{nombreMenor}</strong>{" "}
          {t("minors.declare_relationship_2")}
        </Typography>
      </Box>

      <Box sx={{ p: { xs: 2, sm: 3 }, flex: 1 }}>
        <Alert variant="warm" style={{ marginBottom: 20 }}>
          <strong>{t("minors.legal_warning_title")}</strong>{" "}
          {t("minors.legal_warning_text")}
        </Alert>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {adultos.map((adulto) => {
            const isSelected = expandedIds.includes(adulto.originalIndex);

            // Si el parentesco guardado es uno de los prohibidos, lo limpiamos visualmente
            let parentescoActual =
              relacionesGuardadas.find(
                (r) => r.adultoIndex === adulto.originalIndex,
              )?.parentesco || "";
            if (["HJ", "NI", "CN", "CY", "CO"].includes(parentescoActual))
              parentescoActual = "";

            const nombreAdulto =
              [adulto.nombre, adulto.apellido].filter(Boolean).join(" ") ||
              (adulto.originalIndex === 0
                ? t("common.main_guest")
                : t("forms.adult_tag"));

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
                      sx={{ fontWeight: 600, color: "var(--text)" }}
                    >
                      {nombreAdulto}
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
                        {t("minors.declare_adult_1")}{" "}
                        <strong>{nombreAdulto}</strong>{" "}
                        {t("minors.declare_adult_2")}
                      </Typography>

                      <FormControl
                        size="small"
                        sx={{ minWidth: 160, flexGrow: 1 }}
                      >
                        <Select
                          displayEmpty
                          value={parentescoActual}
                          onChange={(e) =>
                            onRelacionChange(
                              adulto.originalIndex,
                              e.target.value as string,
                            )
                          }
                          sx={{
                            borderRadius: "8px",
                            bgcolor: "#fff",
                            fontWeight: 600,
                            color: parentescoActual
                              ? "var(--primary-d)"
                              : "var(--text-mid)",
                            "& .MuiOutlinedInput-notchedOutline": {
                              borderColor: parentescoActual
                                ? "var(--primary)"
                                : "var(--border)",
                              borderWidth: "1.5px",
                            },
                          }}
                        >
                          <MenuItem value="" disabled>
                            <em>
                              {t(
                                "minors.select_relationship",
                                "Seleccionar...",
                              )}
                            </em>
                          </MenuItem>
                          {relacionesFiltradas.map((rel) => (
                            <MenuItem
                              key={rel.codrelation}
                              value={rel.codrelation}
                            >
                              {t(`parentescos.${rel.codrelation}`, rel.name)}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <Typography
                        sx={{ color: "var(--text)", fontSize: "15px" }}
                      >
                        {t("common.of")} <strong>{nombreMenor}</strong>.
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
            {t("common.save_partial")}
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
          {t("common.continue")}
        </Button>
      </Box>
    </Box>
  );
};
