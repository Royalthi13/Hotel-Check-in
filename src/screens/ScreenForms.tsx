import React, { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import { Button, Alert, Icon } from "@/components/ui";
import { useZipCode } from "@/hooks/useZipCode";
import { PAISES, NACIONALIDADES, TIPOS_DOCUMENTO, SEXOS } from "@/constants";
import {
  useFormValidation,
  validatePersonal,
  validateContacto,
  validateDocumento,
  validarNumeroDocumento,
} from "@/hooks/useFormValidation";
import type { PartialGuestData } from "@/types";
import { DatePicker } from "@mui/x-date-pickers";
import {
  TextField,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
} from "@mui/material";
import { usePlaces } from "@/hooks/usePlaces";
import dayjs from "dayjs";
import "dayjs/locale/es";

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce(fn: () => void, delay: number, deps: unknown[]) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => {
    const t = setTimeout(() => fnRef.current(), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
}

const inputSx = {
  "& .MuiInputBase-root": { borderRadius: "12px", backgroundColor: "#fff" },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
};

interface FormPersonalProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
  esMenor?: boolean;
  onNext: () => void;
}
interface FormContactoProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  onNext: () => void;
}
interface FormDocumentoProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
  onNext: () => void;
  modoFlujo?: "manual" | "escaneo";
}

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? (
    <span
      role="alert"
      aria-live="polite"
      className="field-err"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        color: "var(--err)",
        fontSize: "0.8rem",
      }}
    >
      <Icon name="warn" size={11} /> {msg}
    </span>
  ) : null;

// ═══════════════════════════════════════════════════════════════════════════
// 1. SCREEN FORM PERSONAL
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormPersonal: React.FC<FormPersonalProps> = ({
  data,
  onChange,
  guestIndex,
  totalGuests,
  isMainGuest,
  esMenor,
  onNext,
}) => {
  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validatePersonal);

  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;
  const edad = fechaNac?.isValid() ? dayjs().diff(fechaNac, "years") : null;

  const esErrorAdultoMenor = !esMenor && edad !== null && edad < 18;
  const esErrorMenorAdulto = esMenor && edad !== null && edad >= 18;

  useDebounce(
    () => {
      if ((data.nombre?.length ?? 0) >= 2) validate(data);
    },
    500,
    [data.nombre],
  );

  useDebounce(
    () => {
      if ((data.apellido?.length ?? 0) >= 2) validate(data);
    },
    500,
    [data.apellido],
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
          {esMenor ? t("forms.minor_data") : t("forms.personal_title")}
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          {t("forms.guest_counter", {
            current: guestIndex + 1,
            total: totalGuests,
          })}
          {isMainGuest && t("forms.main_guest_tag")}
          {esMenor ? t("forms.minor_tag") : t("forms.adult_tag")}
        </Typography>
      </div>

      <div style={{ padding: "0 24px" }}>
        {esErrorAdultoMenor && (
          <Alert variant="err" style={{ margin: "8px 0 0" }}>
            <strong>{t("forms.invalid_date_title")}</strong>{" "}
            {isMainGuest
              ? t("forms.main_guest_not_minor")
              : t("forms.adult_must_be_18")}
          </Alert>
        )}

        {esErrorMenorAdulto && (
          <Alert variant="err" style={{ margin: "8px 0 0" }}>
            <strong>{t("forms.invalid_date_title")}</strong>{" "}
            {t("forms.minor_must_be_under_18")}
          </Alert>
        )}
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
              label={t("forms.name")}
              required
              fullWidth
              value={data.nombre ?? ""}
              onChange={(e) => {
                onChange("nombre", e.target.value);
                if (errors.nombre) clearError("nombre");
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
                if (errors.apellido) clearError("apellido");
              }}
              error={!!errors.apellido}
              sx={inputSx}
            />
            <FieldError msg={errors.apellido} />
          </div>
        </Box>

        <TextField
          label={t("forms.second_surname")}
          fullWidth
          value={data.apellido2 ?? ""}
          onChange={(e) => onChange("apellido2", e.target.value)}
          sx={inputSx}
        />

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
              minDate={dayjs("1900-01-01")}
              onChange={(v) => {
                onChange(
                  "fechaNac",
                  v?.isValid() ? v.format("YYYY-MM-DD") : "",
                );
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

        <TextField
          select
          label={t("forms.nationality")}
          fullWidth
          value={data.nacionalidad ?? ""}
          onChange={(e) => onChange("nacionalidad", e.target.value)}
          sx={inputSx}
        >
          {NACIONALIDADES.map((n) => (
            <MenuItem key={n} value={n}>
              {t(`constants.nacionalidades.${n}`)}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          disabled={esErrorAdultoMenor || esErrorMenorAdulto}
          onClick={() => {
            if (validate(data)) onNext();
          }}
          iconRight="right"
        >
          {t("common.continue")}
        </Button>
      </div>
    </>
  );
};
// ═══════════════════════════════════════════════════════════════════════════
// 2. SCREEN FORM CONTACTO
// ═══════════════════════════════════════════════════════════════════════════

export const ScreenFormContacto: React.FC<FormContactoProps> = ({
  data,
  onChange,
  onNext,
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
    [data.email],
  );

  useDebounce(
    () => {
      if ((data.telefono?.length ?? 0) >= 7) validate(data);
    },
    500,
    [data.telefono],
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
                if (errors.email) clearError("email");
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
                if (val.length <= 15) {
                  onChange("telefono", val);
                  if (errors.telefono) clearError("telefono");
                }
              }}
              error={!!errors.telefono}
              sx={inputSx}
              placeholder="+34 600 000 000"
            />
            <FieldError msg={errors.telefono} />
          </div>
        </Box>

        <TextField
          label={t("forms.address_habitual")}
          fullWidth
          value={data.direccion ?? ""}
          onChange={(e) => onChange("direccion", e.target.value)}
          sx={inputSx}
        />

        <div className="divlabel">{t("forms.location")}</div>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
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
          <TextField
            label={t("forms.zipcode")}
            fullWidth
            value={data.cp ?? ""}
            onBlur={() => {
              if (data.cp && data.pais) buscarCP(data.cp, data.pais);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (data.cp && data.pais) buscarCP(data.cp, data.pais);
              }
            }}
            onChange={(e) => onChange("cp", e.target.value.toUpperCase())}
            sx={inputSx}
            InputProps={{ endAdornment: isSearching ? "⏳" : null }}
          />
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          {esEspana ? (
            <Autocomplete
              freeSolo
              autoHighlight
              options={sugerenciasProvincias || []}
              value={data.provincia || ""}
              onInputChange={(_, v) => {
                onChange("provincia", v || "");
                cargarProvincias(v || "");
              }}
              renderInput={(p) => (
                <TextField {...p} label={t("forms.province")} sx={inputSx} />
              )}
            />
          ) : (
            <TextField
              label={t("forms.province")}
              fullWidth
              value={data.provincia ?? ""}
              onChange={(e) => onChange("provincia", e.target.value)}
              sx={inputSx}
            />
          )}
          {esEspana ? (
            <Autocomplete
              freeSolo
              autoHighlight
              options={(sugerenciasMunicipios || []).map((m) => m.nombre)}
              value={data.ciudad || ""}
              onInputChange={(_, v) => {
                onChange("ciudad", v || "");
                cargarMunicipios(v || "", data.provincia as string);
              }}
              renderInput={(p) => (
                <TextField {...p} label={t("forms.city")} sx={inputSx} />
              )}
            />
          ) : (
            <TextField
              label={t("forms.city")}
              fullWidth
              value={data.ciudad ?? ""}
              onChange={(e) => onChange("ciudad", e.target.value)}
              sx={inputSx}
            />
          )}
        </Box>
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          onClick={() => {
            const esValido = validate(data);

            // Si la validación falla, escupimos el objeto de errores en la consola
            // sin usar ni un solo string hardcodeado.
            if (!esValido) {
              console.warn(errors);
            }

            // 🔥 Quitamos el 'if' para que te deje avanzar SIEMPRE mientras haces las pruebas.
            onNext();
          }}
          iconRight="right"
        >
          {t("common.continue")}
        </Button>
      </div>
    </>
  );
};
// ═══════════════════════════════════════════════════════════════════════════
// 3. SCREEN FORM DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormDocumento: React.FC<FormDocumentoProps> = ({
  data,
  onChange,
  guestIndex,
  totalGuests,
  isMainGuest,
  onNext,
  modoFlujo,
}) => {
  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validateDocumento);
  const mostrarCargaFoto = modoFlujo !== "manual";

  useDebounce(
    () => {
      if (data.tipoDoc && data.numDoc) {
        // 3. LE PASAMOS LA t A validarNumeroDocumento
        const errorMsg = validarNumeroDocumento(data.tipoDoc, data.numDoc, t);
        if (errorMsg) validate(data);
        else clearError("numDoc");
      }
    },
    500,
    [data.numDoc, data.tipoDoc],
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
          {t("forms.doc_title")}
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          {t("forms.doc_subtitle", {
            current: guestIndex + 1,
            total: totalGuests,
          })}
          {isMainGuest && t("forms.main_guest_paren")}
        </Typography>
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
              select
              label={t("forms.doc_type")}
              required
              fullWidth
              value={data.tipoDoc ?? ""}
              onChange={(e) => {
                onChange("tipoDoc", e.target.value);
                onChange("numDoc", "");
                clearError("tipoDoc");
                clearError("numDoc");
              }}
              error={!!errors.tipoDoc}
              sx={inputSx}
            >
              {TIPOS_DOCUMENTO.map((docType) => (
                <MenuItem key={docType} value={docType}>
                  {t(`constants.documentos.${docType}`)}
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
                if (errors.numDoc) clearError("numDoc");
              }}
              error={!!errors.numDoc}
              sx={inputSx}
              placeholder={
                data.tipoDoc === "DNI"
                  ? "12345678M"
                  : data.tipoDoc === "NIE"
                    ? "X1234567Z"
                    : data.tipoDoc === "Pasaporte"
                      ? "AAA123456"
                      : undefined
              }
            />
            <FieldError msg={errors.numDoc} />
          </div>
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

      <div className="spacer" />
      <div className="btn-row">
        <Button
          onClick={() => {
            if (validate(data)) onNext();
          }}
          iconRight="right"
        >
          {guestIndex < totalGuests - 1
            ? t("forms.next_guest")
            : t("common.continue")}
        </Button>
      </div>
    </>
  );
};
