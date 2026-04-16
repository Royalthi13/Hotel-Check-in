import React, { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button, Alert } from "@/components/ui";
import { getRelationships } from "@/api/catalogs.service";
import type { PartialGuestData, RelacionDB } from "@/types";
import {
  Box,
  Typography,
  Paper,
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

  // 2. 🛡️ FILTRO ULTRA-SEGURO (A prueba de bombas)
  const relacionesFiltradas = useMemo(() => {
    if (!Array.isArray(listaRelaciones)) return [];

    const codigosBloqueados = ["HJ", "NI", "HI", "CN", "CY", "CO"];

    return listaRelaciones.filter((r) => {
      if (!r || !r.codrelation) return false;

      const codigo = r.codrelation.toUpperCase();
      const nombre = (r.name || "").toLowerCase();

      const porCodigo = !codigosBloqueados.includes(codigo);
      const porNombre =
        !nombre.includes("conyuge") &&
        !nombre.includes("hijo") &&
        !nombre.includes("nieto");

      return porCodigo && porNombre;
    });
  }, [listaRelaciones]);

  const nombreMenor =
    [menor.nombre, menor.apellido].filter(Boolean).join(" ") ||
    t("minors.this_minor");
  const relacionesGuardadas = menor.relacionesConAdultos ?? [];

  // 3. Validación ultra estricta: TODOS los adultos deben tener parentesco
  const esValido =
    adultos.length > 0 &&
    adultos.every((adulto) => {
      const r = relacionesGuardadas.find(
        (rel) => rel.adultoIndex === adulto.originalIndex,
      );
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
            // Buscamos si ya ha seleccionado algo para limpiarlo si es inválido
            let parentescoActual =
              relacionesGuardadas.find(
                (r) => r.adultoIndex === adulto.originalIndex,
              )?.parentesco || "";

            if (["HJ", "NI", "CN", "CY", "CO"].includes(parentescoActual)) {
              parentescoActual = "";
            }

            const nombreAdulto =
              [adulto.nombre, adulto.apellido].filter(Boolean).join(" ") ||
              (adulto.originalIndex === 0
                ? t("common.main_guest")
                : t("forms.adult_tag"));

            return (
              <Paper
                key={adulto.originalIndex}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: "16px",
                  border: "2px solid",
                  borderColor: parentescoActual
                    ? "var(--primary)"
                    : "var(--err)",
                  bgcolor: parentescoActual ? "var(--primary-lt)" : "#fff",
                  transition: "all 0.2s ease",
                }}
              >
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <Box>
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

                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 1,
                      backgroundColor: "rgba(255,255,255,0.7)",
                      p: 1.5,
                      borderRadius: "12px",
                    }}
                  >
                    <Typography sx={{ color: "var(--text)", fontSize: "14px" }}>
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
                              : "var(--err)",
                            borderWidth: "1.5px",
                          },
                        }}
                      >
                        <MenuItem value="" disabled>
                          <em>
                            {t("minors.select_relationship", "Seleccionar...")}
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

                    <Typography sx={{ color: "var(--text)", fontSize: "14px" }}>
                      {t("common.of")} <strong>{nombreMenor}</strong>.
                    </Typography>
                  </Box>
                </Box>
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
