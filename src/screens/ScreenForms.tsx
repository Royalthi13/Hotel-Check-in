// Ubicación: src/screens/ScreenForms.tsx

import React, { useState } from "react";
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
  InputAdornment,
  CircularProgress,
} from "@mui/material";
import { usePlaces } from "@/hooks/usePlaces";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useDebounce } from "@/hooks/useDebounce";
import { useCheckinContext } from "@/context/CheckinContext"; // Importamos el contexto

const inputSx = {
  "& :not(.MuiInputAdornment-root) > .MuiInputBase-root": {
    borderRadius: "12px",
    backgroundColor: "#fff",
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
};

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

// Eliminadas las Props. Ya no recibimos nada de App.tsx
export const ScreenFormPersonal: React.FC = () => {
  // 1. Nos conectamos a la "nube" para bajar nuestros datos y funciones
  const { state, nav, actions, isSubmitting, token, handlePartialSubmit } =
    useCheckinContext();

  // 2. Reconstruimos las variables que antes nos pasaban como props
  const guestIndex = nav.guestIndex;
  const data = state.guests[guestIndex] ?? {};
  const allGuests = state.guests;
  const totalGuests = state.numPersonas;
  const isMainGuest = guestIndex === 0;
  const esMenor = !!data.esMenor;

  const onChange = (key: keyof PartialGuestData, value: unknown) =>
    actions.updateGuest(guestIndex, key, value);
  const onNext = () => actions.nextGuest(guestIndex, "form_personal");
  const onPartialSave = handlePartialSubmit;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    checkAndProceed(onNext);
  };

  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validatePersonal);
  const [duplicateError, setDuplicateError] = useState("");

  const modoFlujo = sessionStorage.getItem(`modoFlujo_${token}`) || "manual";
  const mostrarCargaFoto = modoFlujo !== "manual";
  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;
  const isDniOrNie = data.tipoDoc === "DNI" || data.tipoDoc === "NIE";

  useDebounce(
    () => {
      if ((data.nombre?.length ?? 0) >= 2)
        validate({ ...data, isTitular: isMainGuest });
    },
    500,
    [data.nombre],
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
        setDuplicateError(t("validation.duplicate_doc"));
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
            ? ` · ${t("forms.main_guest_tag")}`
            : esMenor
              ? t("forms.minor_tag")
              : t("forms.adult_tag")}
        </Typography>
      </div>
      <form onSubmit={handleSubmit}>
        {/* MEJORA DE SEGURIDAD: Bloquea todos los inputs a la vez si está enviando */}
        <fieldset
          disabled={isSubmitting}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          <Box
            style={{ padding: "0 var(--px)" }}
            sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}
          >
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
                <TextField
                  label={t("forms.second_surname")}
                  fullWidth
                  value={data.apellido2 ?? ""}
                  onChange={(e) => onChange("apellido2", e.target.value)}
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
                  }}
                  error={!!errors.numDoc}
                  sx={inputSx}
                />
                <FieldError msg={errors.numDoc} />
              </div>
              {isDniOrNie && (
                <div>
                  <TextField
                    label={t("forms.doc_support")}
                    required
                    fullWidth
                    value={data.soporteDoc ?? ""}
                    onChange={(e) => {
                      onChange("soporteDoc", e.target.value.toUpperCase());
                      clearError("soporteDoc");
                    }}
                    error={!!errors.soporteDoc}
                    sx={inputSx}
                  />
                  <FieldError msg={errors.soporteDoc} />
                </div>
              )}
            </Box>

            {mostrarCargaFoto && (
              <label
                htmlFor={`doc-${guestIndex}`}
                style={{ cursor: "pointer" }}
              >
                <div
                  className={`upload-area ${data.docUploaded ? "done" : ""}`}
                >
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
                    if (f) {
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
            {!isMainGuest && hasNextGuest && onPartialSave && (
              <Button
                variant="secondary"
                onClick={() => checkAndProceed(onPartialSave)}
                disabled={isSubmitting}
                style={{ flex: 1, minWidth: "200px" }}
              >
                {isSubmitting ? "..." : t("common.save_partial")}
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
                  ? t("common.next_guest")
                  : t("common.continue")}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
};

// Eliminadas las Props. Ya no recibimos nada de App.tsx
export const ScreenFormContacto: React.FC = () => {
  // 1. Nos conectamos a la "nube"
  const { state, nav, actions, isSubmitting, handlePartialSubmit } =
    useCheckinContext();

  // 2. Reconstruimos las variables
  const guestIndex = nav.guestIndex;
  const data = state.guests[guestIndex] ?? {};
  const hasNextGuest = state.numPersonas > 1;
  const lockedFields = {
    email: !!state.knownGuest?.email,
    telefono: !!state.knownGuest?.telefono,
  };

  const onChange = (key: keyof PartialGuestData, value: unknown) =>
    actions.updateGuest(guestIndex, key, value);
  const onNext = () => actions.nextGuest(guestIndex, "form_contacto");
  const onPartialSave = handlePartialSubmit;

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (validate(data)) onNext();
  };

  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(
    (d: PartialGuestData, t) => validateContacto(d, t, lockedFields),
  );
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
      <form onSubmit={handleSubmit}>
        <fieldset
          disabled={isSubmitting}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
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
                  required={
                    !lockedFields?.email && !lockedFields?.telefono
                      ? !data.telefono?.trim()
                      : !lockedFields?.telefono
                  }
                  fullWidth
                  value={data.email ?? ""}
                  onChange={
                    lockedFields?.email
                      ? undefined
                      : (e) => {
                          onChange("email", e.target.value);
                          clearError("email");
                        }
                  }
                  error={!!errors.email}
                  sx={{
                    ...inputSx,
                    ...(lockedFields?.email ? { opacity: 0.72 } : {}),
                  }}
                  InputProps={{
                    readOnly: !!lockedFields?.email,
                    endAdornment: lockedFields?.email ? (
                      <InputAdornment position="end">
                        <Icon name="lock" size={13} color="var(--text-low)" />
                      </InputAdornment>
                    ) : undefined,
                  }}
                  helperText={
                    lockedFields?.email
                      ? t("forms.field_from_reservation")
                      : undefined
                  }
                />
                <FieldError msg={errors.email} />
              </div>
              <div>
                <TextField
                  label={t("forms.phone")}
                  required={
                    !lockedFields?.email && !lockedFields?.telefono
                      ? !data.email?.trim()
                      : !lockedFields?.email
                  }
                  fullWidth
                  type="tel"
                  value={data.telefono ?? ""}
                  onChange={
                    lockedFields?.telefono
                      ? undefined
                      : (e) => {
                          onChange(
                            "telefono",
                            e.target.value.replace(/(?!^\+)[^\d]/g, ""),
                          );
                          clearError("telefono");
                        }
                  }
                  error={!!errors.telefono}
                  sx={{
                    ...inputSx,
                    ...(lockedFields?.telefono ? { opacity: 0.72 } : {}),
                  }}
                  InputProps={{
                    readOnly: !!lockedFields?.telefono,
                    endAdornment: lockedFields?.telefono ? (
                      <InputAdornment position="end">
                        <Icon name="lock" size={13} color="var(--text-low)" />
                      </InputAdornment>
                    ) : undefined,
                  }}
                  helperText={
                    lockedFields?.telefono
                      ? t("forms.field_from_reservation")
                      : undefined
                  }
                  placeholder="+34 600 000 000"
                />
                <FieldError msg={errors.telefono} />
              </div>
            </Box>

            <TextField
              label={t("forms.address")}
              fullWidth
              value={data.direccion ?? ""}
              onChange={(e) => {
                onChange("direccion", e.target.value);
                clearError("direccion");
              }}
              error={!!errors.direccion}
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
                  onChange={(e) => {
                    onChange("cp", e.target.value.toUpperCase());
                    clearError("cp");
                  }}
                  onBlur={() => {
                    if (data.cp && data.pais && !esEspana)
                      buscarCP(data.cp, data.pais);
                  }}
                  InputProps={{
                    endAdornment: isSearching ? (
                      <InputAdornment position="end">
                        <CircularProgress size={18} thickness={5} />
                      </InputAdornment>
                    ) : null,
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
                    onChange={(e) => onChange("provincia", e.target.value)}
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
                    onChange={(e) => onChange("ciudad", e.target.value)}
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
                {isSubmitting ? "..." : t("common.save_partial")}
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
                  ? t("common.next_guest")
                  : t("common.continue")}
            </Button>
          </div>
        </fieldset>
      </form>
    </>
  );
};
