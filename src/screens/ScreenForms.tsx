import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Alert } from "@/components/ui";
import { useZipCode } from "@/hooks/useZipCode";
import { TIPOS_DOCUMENTO, SEXOS, PAISES } from "@/constants";
import {
  useFormValidation,
  validatePersonal,
  validateContacto,
} from "@/hooks/useFormValidation";
import type { PartialGuestData } from "@/types";
import { DatePicker } from "@mui/x-date-pickers";
import {
  TextField,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
  Divider,
} from "@mui/material";
import { usePlaces } from "@/hooks/usePlaces";
import dayjs from "dayjs";
import "dayjs/locale/es";

function useDebounce(fn: () => void, delay: number, watchValue: unknown) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);
  useEffect(() => {
    const t = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(t);
  }, [watchValue, delay]);
}

const inputSx = {
  "& .MuiInputBase-root": { borderRadius: "12px", backgroundColor: "#fff" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
};

interface FormPersonalProps {
  data: PartialGuestData;
  allGuests: PartialGuestData[];
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
  esMenor?: boolean;
  onNext: () => void;
  onPartialSave: () => void;
  isSubmitting: boolean;
}

interface FormContactoProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  onNext: () => void;
  onPartialSave: () => void;
  hasNextGuest: boolean;
  isSubmitting: boolean;
}

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? (
    <span
      role="alert"
      className="field-err"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "var(--err)",
        fontSize: "0.8rem",
        marginTop: "4px",
      }}
    >
      <Icon name="warn" size={11} /> {msg}
    </span>
  ) : null;

export const ScreenFormPersonal: React.FC<FormPersonalProps> = ({
  data,
  allGuests,
  onChange,
  guestIndex,
  totalGuests,
  isMainGuest,
  esMenor,
  onNext,
  onPartialSave,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validatePersonal);
  const [duplicateError, setDuplicateError] = useState("");

  const modoFlujo = sessionStorage.getItem(`modoFlujo`) || "manual";
  const mostrarCargaFoto = modoFlujo !== "manual";
  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;

  const isDniOrNie = data.tipoDoc === "DNI" || data.tipoDoc === "NIE";

  useDebounce(
    () => {
      if ((data.nombre?.length ?? 0) >= 2)
        validate({ ...data, isTitular: isMainGuest });
    },
    500,
    data.nombre,
  );

  const hasNextGuest = guestIndex < totalGuests - 1;

  const checkAndProceed = (action: () => void) => {
    setDuplicateError("");
    if (!validate({ ...data, isTitular: isMainGuest })) return;

    const currentDoc = data.numDoc?.trim().toUpperCase();
    if (currentDoc) {
      const isDuplicate = allGuests.some(
        (g, i) =>
          i !== guestIndex && g.numDoc?.trim().toUpperCase() === currentDoc,
      );

      if (isDuplicate) {
        setDuplicateError(
          t("validation.duplicate_doc", {
            defaultValue:
              "Este documento ya ha sido registrado en otro huésped.",
          }),
        );
        return;
      }
    }
    action();
  };

  return (
    <>
      <div className="sec-hdr">
        <Typography
          variant="h2"
          sx={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "var(--fs-2xl)",
          }}
        >
          {isMainGuest
            ? t("forms.personal_title")
            : esMenor
              ? t("forms.minor_data")
              : t("forms.personal_title")}
        </Typography>

        <Typography variant="body2" color="var(--text-low)">
          {t("forms.guest_counter", {
            current: guestIndex + 1,
            total: totalGuests,
          })}
          {isMainGuest
            ? ` · ${t("forms.main_guest_tag").replace("·", "").trim()}`
            : esMenor
              ? t("forms.minor_tag")
              : t("forms.adult_tag")}
        </Typography>
      </div>

      <Box
        style={{ padding: "0 var(--px)" }}
        sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        {/* 🔥 AÑADIDO: Nombre, Primer Apellido y Segundo Apellido en 3 columnas */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
            gap: 2,
          }}
        >
          <div>
            <TextField
              label={t("forms.name")}
              required
              fullWidth
              value={data.nombre ?? ""}
              onChange={(e) => {
                onChange("nombre", e.target.value);
                clearError("nombre");
              }}
              error={!!errors.nombre}
              sx={inputSx}
            />
            <FieldError msg={errors.nombre} />
          </div>
          <div>
            <TextField
              label={t("forms.surname")}
              required
              fullWidth
              value={data.apellido ?? ""}
              onChange={(e) => {
                onChange("apellido", e.target.value);
                clearError("apellido");
              }}
              error={!!errors.apellido}
              sx={inputSx}
            />
            <FieldError msg={errors.apellido} />
          </div>
          <div>
            {/* El segundo apellido no es required para evitar bloquear a huéspedes extranjeros */}
            <TextField
              label={t("forms.second_surname")}
              fullWidth
              value={data.apellido2 ?? ""}
              onChange={(e) => {
                onChange("apellido2", e.target.value);
              }}
              sx={inputSx}
            />
          </div>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <div>
            <TextField
              select
              label={t("forms.gender")}
              required
              fullWidth
              value={data.sexo ?? ""}
              onChange={(e) => {
                onChange("sexo", e.target.value);
                clearError("sexo");
              }}
              error={!!errors.sexo}
              sx={inputSx}
            >
              {SEXOS.map((s) => (
                <MenuItem key={s} value={s}>
                  {t(`constants.sexos.${s}`)}
                </MenuItem>
              ))}
            </TextField>
            <FieldError msg={errors.sexo} />
          </div>
          <div>
            <DatePicker
              label={t("forms.birthdate")}
              value={fechaNac}
              disableFuture
              onChange={(v) => {
                const formatted = v?.isValid() ? v.format("YYYY-MM-DD") : "";
                onChange("fechaNac", formatted);
                clearError("fechaNac");
              }}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.fechaNac,
                  sx: inputSx,
                },
              }}
            />
            <FieldError msg={errors.fechaNac} />
          </div>
        </Box>

        <Divider
          sx={{ my: 1, typography: "overline", color: "var(--text-low)" }}
        >
          {t("forms.doc_title")}
        </Divider>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "1fr",
              sm: isDniOrNie ? "1fr 1fr 1fr" : "1fr 1fr",
            },
            gap: 2,
          }}
        >
          <div>
            <TextField
              select
              label={t("forms.doc_type")}
              required
              fullWidth
              value={data.tipoDoc ?? ""}
              onChange={(e) => {
                onChange("tipoDoc", e.target.value);
                clearError("tipoDoc");
                clearError("soporteDoc");
              }}
              error={!!errors.tipoDoc}
              sx={inputSx}
            >
              {TIPOS_DOCUMENTO.map((doc) => (
                <MenuItem key={doc} value={doc}>
                  {t(`constants.documentos.${doc}`)}
                </MenuItem>
              ))}
            </TextField>
            <FieldError msg={errors.tipoDoc} />
          </div>
          <div>
            <TextField
              label={t("forms.doc_number")}
              required
              fullWidth
              value={data.numDoc ?? ""}
              onChange={(e) => {
                onChange("numDoc", e.target.value.toUpperCase());
                clearError("numDoc");
                setDuplicateError("");
              }}
              error={!!errors.numDoc}
              sx={inputSx}
            />
            <FieldError msg={errors.numDoc} />
          </div>
          {isDniOrNie && (
            <div>
              <TextField
                label={t("forms.doc_support", { defaultValue: "Soporte" })}
                required
                fullWidth
                value={data.soporteDoc ?? ""}
                onChange={(e) => {
                  onChange("soporteDoc", e.target.value.toUpperCase());
                  clearError("soporteDoc");
                }}
                error={!!errors.soporteDoc}
                sx={inputSx}
                placeholder="Ej: IDESP..."
              />
              <FieldError msg={errors.soporteDoc} />
            </div>
          )}
        </Box>

        {mostrarCargaFoto && (
          <label htmlFor={`doc-${guestIndex}`} style={{ cursor: "pointer" }}>
            <div className={`upload-area ${data.docUploaded ? "done" : ""}`}>
              <Icon
                name={data.docUploaded ? "checkC" : "upload"}
                size={24}
                color={data.docUploaded ? "var(--ok)" : "var(--text-low)"}
              />
              <p style={{ marginTop: 8, fontSize: 14 }}>
                {data.docUploaded
                  ? t("forms.photo_uploaded")
                  : t("forms.upload_photo")}
              </p>
            </div>
            <input
              id={`doc-${guestIndex}`}
              type="file"
              hidden
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f && f.size < 10485760) {
                  onChange("docFile", f);
                  onChange("docUploaded", true);
                }
              }}
            />
          </label>
        )}
      </Box>

      {duplicateError && (
        <Box sx={{ padding: "0 var(--px)", mt: 2 }}>
          <Alert variant="err">{duplicateError}</Alert>
        </Box>
      )}

      <div className="spacer" />
      <div
        className="btn-row"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {!isMainGuest && hasNextGuest && (
          <Button
            variant="secondary"
            onClick={() => checkAndProceed(onPartialSave)}
            disabled={isSubmitting}
            style={{ flex: 1, minWidth: "200px" }}
          >
            {isSubmitting
              ? "..."
              : t("common.save_partial", {
                  defaultValue: "Guardar y seguir luego",
                })}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => checkAndProceed(onNext)}
          iconRight="right"
          disabled={isSubmitting}
          style={{ flex: 1, minWidth: "200px" }}
        >
          {isSubmitting
            ? "..."
            : hasNextGuest
              ? t("common.next_guest", { defaultValue: "Siguiente persona" })
              : t("common.continue")}
        </Button>
      </div>
    </>
  );
};

export const ScreenFormContacto: React.FC<FormContactoProps> = ({
  data,
  onChange,
  onNext,
  onPartialSave,
  hasNextGuest,
  isSubmitting,
}) => {
  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validateContacto);
  const { buscarCP, isSearching } = useZipCode(onChange);
  const {
    sugerenciasProvincias,
    sugerenciasMunicipios,
    cargarProvincias,
    cargarMunicipios,
  } = usePlaces();
  const esEspana = data.pais === "España";

  useDebounce(
    () => {
      if (data.email?.includes("@")) validate(data);
    },
    500,
    data.email,
  );
  useDebounce(
    () => {
      if ((data.telefono?.length ?? 0) >= 7) validate(data);
    },
    500,
    data.telefono,
  );

  return (
    <>
      <div className="sec-hdr">
        <Typography
          variant="h2"
          sx={{
            fontFamily: "Cormorant Garamond, serif",
            fontSize: "var(--fs-2xl)",
          }}
        >
          {t("forms.contact_title")}
        </Typography>
        <p>{t("forms.contact_subtitle")}</p>
      </div>
      <Box
        style={{ padding: "0 var(--px)" }}
        sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <div>
            <TextField
              label={t("forms.email")}
              required
              fullWidth
              value={data.email ?? ""}
              onChange={(e) => {
                onChange("email", e.target.value);
                clearError("email");
              }}
              error={!!errors.email}
              sx={inputSx}
            />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <TextField
              label={t("forms.phone")}
              required
              fullWidth
              type="tel"
              value={data.telefono ?? ""}
              onChange={(e) => {
                const val = e.target.value.replace(/(?!^\+)[^\d]/g, "");
                onChange("telefono", val);
                clearError("telefono");
              }}
              error={!!errors.telefono}
              sx={inputSx}
              placeholder="+34 600 000 000"
            />
            <FieldError msg={errors.telefono} />
          </div>
        </Box>
        <div>
          <TextField
            label={t("forms.address_habitual")}
            fullWidth
            value={data.direccion ?? ""}
            onChange={(e) => {
              onChange("direccion", e.target.value);
              clearError("direccion");
            }}
            error={!!errors.direccion}
            sx={inputSx}
          />
          <FieldError msg={errors.direccion} />
        </div>
        <div className="divlabel">{t("forms.location")}</div>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <div>
            <TextField
              select
              label={t("forms.country")}
              required
              fullWidth
              value={data.pais ?? ""}
              onChange={(e) => {
                onChange("pais", e.target.value);
                clearError("pais");
              }}
              error={!!errors.pais}
              sx={inputSx}
            >
              {PAISES.map((p) => (
                <MenuItem key={p} value={p}>
                  {t(`constants.paises.${p}`)}
                </MenuItem>
              ))}
            </TextField>
            <FieldError msg={errors.pais} />
          </div>
          <div>
            <TextField
              label={t("forms.zipcode")}
              fullWidth
              value={data.cp ?? ""}
              onBlur={() => {
                if (data.cp && data.pais) buscarCP(data.cp, data.pais);
              }}
              InputProps={{
                endAdornment: isSearching ? (
                  <div
                    className="spinner"
                    style={{ width: 16, height: 16, borderWidth: 2 }}
                  />
                ) : null,
              }}
              onChange={(e) => {
                onChange("cp", e.target.value.toUpperCase());
                clearError("cp");
              }}
              error={!!errors.cp}
              sx={inputSx}
            />
            <FieldError msg={errors.cp} />
          </div>
        </Box>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <div>
            {esEspana ? (
              <Autocomplete
                freeSolo
                options={sugerenciasProvincias || []}
                value={data.provincia || ""}
                onInputChange={(_, v) => {
                  onChange("provincia", v || "");
                  cargarProvincias(v || "");
                  clearError("provincia");
                }}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    label={t("forms.province")}
                    error={!!errors.provincia}
                    sx={inputSx}
                  />
                )}
              />
            ) : (
              <TextField
                label={t("forms.province")}
                fullWidth
                value={data.provincia ?? ""}
                onChange={(e) => {
                  onChange("provincia", e.target.value);
                  clearError("provincia");
                }}
                error={!!errors.provincia}
                sx={inputSx}
              />
            )}
            <FieldError msg={errors.provincia} />
          </div>
          <div>
            {esEspana ? (
              <Autocomplete
                freeSolo
                options={(sugerenciasMunicipios || []).map((m) => m.nombre)}
                value={data.ciudad || ""}
                onInputChange={(_, v) => {
                  onChange("ciudad", v || "");
                  cargarMunicipios(v || "", data.provincia as string);
                  clearError("ciudad");
                }}
                renderInput={(p) => (
                  <TextField
                    {...p}
                    label={t("forms.city")}
                    error={!!errors.ciudad}
                    sx={inputSx}
                  />
                )}
              />
            ) : (
              <TextField
                label={t("forms.city")}
                fullWidth
                value={data.ciudad ?? ""}
                onChange={(e) => {
                  onChange("ciudad", e.target.value);
                  clearError("ciudad");
                }}
                error={!!errors.ciudad}
                sx={inputSx}
              />
            )}
            <FieldError msg={errors.ciudad} />
          </div>
        </Box>
      </Box>

      <div className="spacer" />
      <div
        className="btn-row"
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {hasNextGuest && (
          <Button
            variant="secondary"
            onClick={() => {
              if (validate(data)) onPartialSave();
            }}
            disabled={isSubmitting}
            style={{ flex: 1, minWidth: "200px" }}
          >
            {isSubmitting
              ? "..."
              : t("common.save_partial", {
                  defaultValue: "Guardar y seguir luego",
                })}
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => {
            if (validate(data)) onNext();
          }}
          iconRight="right"
          disabled={isSubmitting}
          style={{ flex: 1, minWidth: "200px" }}
        >
          {isSubmitting
            ? "..."
            : hasNextGuest
              ? t("common.next_guest", { defaultValue: "Siguiente persona" })
              : t("common.continue")}
        </Button>
      </div>
    </>
  );
};
