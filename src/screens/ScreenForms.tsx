import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Button, Icon, Alert } from "@/components/ui";
import { useZipCode } from "@/hooks/useZipCode";
import { TIPOS_DOCUMENTO, SEXOS, PREFIJOS_TELEFONICOS } from "@/constants";
import { getDocumentTypes } from "@/api/catalogs.service";
import {
  useFormValidation,
  validatePersonal,
  validateContacto,
} from "@/hooks/useFormValidation";
import type { PartialGuestData, GuestData } from "@/types";
import { DatePicker } from "@mui/x-date-pickers";
import {
  TextField,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
  Divider,
  Dialog,
  InputAdornment,
  CircularProgress,
  Tooltip,
  useMediaQuery,
  useTheme,
  Menu,
} from "@mui/material";
import { usePlaces } from "@/hooks/usePlaces";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/es";
import { useDebounce } from "@/hooks/useDebounce";
import { useCheckinContext } from "@/context/useCheckinContext";
import { formatDocument, formatPhoneNumber } from "@/utils/formatters";
import type { TFunction } from "i18next";
const inputSx = {
  "& :not(.MuiInputAdornment-root) > .MuiInputBase-root": {
    borderRadius: "12px",
    backgroundColor: "#fff",
  },
  "& .MuiOutlinedInput-notchedOutline": { borderColor: "var(--border)" },
};
const COD_TO_FRONTEND: Record<string, string> = {
  NIF: "DNI", NIE: "NIE", CIF: "CIF", PAS: "Pasaporte", OTRO: "Otro",
};


const modalPaperSx = {
  borderRadius: "16px",
  maxHeight: "80vh",
  margin: "16px",
  backgroundColor: "#fff",
  overflow: "hidden",
};

const menuPaperSx = {
  borderRadius: "15px",
  mt: 1,
  boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
  overflow: "hidden",
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
// ─── COMPONENTE 1: DATOS PERSONALES ─────────────────────────────────────────
export const ScreenFormPersonal: React.FC = () => {
  const { state, nav, actions, isSubmitting } = useCheckinContext();
  const guestIndex = nav.guestIndex;
  const data = useMemo<Partial<GuestData>>(
    () => state.guests[guestIndex] ?? {},
    [state.guests, guestIndex],
  );
  const { t } = useTranslation();
  const { errors, validate, clearError } = useFormValidation(validatePersonal);
  const [duplicateError, setDuplicateError] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [tiposDoc, setTiposDoc] = useState<Array<{ value: string; label: string }>>([]);

  const isMainGuest = guestIndex === 0;

  useEffect(() => {
    getDocumentTypes()
      .then((tipos) =>
        setTiposDoc(
          tipos.map((tipo) => ({
            value: COD_TO_FRONTEND[tipo.coddoc] ?? tipo.coddoc,
            label: tipo.name,
          })),
        ),
      )
      .catch(() =>
        setTiposDoc(TIPOS_DOCUMENTO.map((d) => ({ value: d, label: d }))),
      );
  }, []);

  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;
  const isDniOrNie = data.tipoDoc === "DNI" || data.tipoDoc === "NIE";

  const handleUpdate = (key: keyof PartialGuestData, value: unknown) =>
    actions.updateGuest(guestIndex, key, value);
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDuplicateError("");
    if (!validate({ ...data, isTitular: isMainGuest })) return;

    const currentDoc = data.numDoc?.trim().toUpperCase();
    if (
      currentDoc &&
      state.guests.some(
        (g, i) =>
          i !== guestIndex && g.numDoc?.trim().toUpperCase() === currentDoc,
      )
    ) {
      setDuplicateError(t("validation.duplicate_doc"));
      return;
    }
    actions.nextGuest(guestIndex, "form_personal");
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
            : data.esMenor
              ? t("forms.minor_data")
              : t("forms.personal_title")}
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          {t("forms.guest_counter", {
            current: guestIndex + 1,
            total: state.numPersonas,
          })}
        </Typography>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <fieldset
          disabled={isSubmitting}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          <Box
            sx={{
              mt: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              px: "var(--px)",
            }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                label={t("forms.name")}
                required
                fullWidth
                value={data.nombre ?? ""}
                onChange={(e) => {
                  handleUpdate("nombre", e.target.value);
                  clearError("nombre");
                }}
                error={!!errors.nombre}
                sx={inputSx}
              />
              <TextField
                label={t("forms.surname")}
                required
                fullWidth
                value={data.apellido ?? ""}
                onChange={(e) => {
                  handleUpdate("apellido", e.target.value);
                  clearError("apellido");
                }}
                error={!!errors.apellido}
                sx={inputSx}
              />
              <TextField
                label={t("forms.second_surname")}
                fullWidth
                value={data.apellido2 ?? ""}
                onChange={(e) => handleUpdate("apellido2", e.target.value)}
                sx={inputSx}
              />
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
                    handleUpdate("sexo", e.target.value);
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
                 onChange={(v: Dayjs | null) => {
                    handleUpdate(
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
                 value={
                    tiposDoc.some((d) => d.value === data.tipoDoc)
                      ? data.tipoDoc
                      : ""
                  }
                  onChange={(e) => {
                    handleUpdate("tipoDoc", e.target.value);
                    clearError("tipoDoc");
                  }}
                  error={!!errors.tipoDoc}
                  sx={inputSx}
                >{(tiposDoc.length > 0
                    ? tiposDoc
                    : TIPOS_DOCUMENTO.map((d) => ({ value: d, label: d }))
                  ).map((doc) => (
                    <MenuItem key={doc.value} value={doc.value}>
                      {t(`constants.documentos.${doc.value}`, {
                        defaultValue: doc.label,
                      })}
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
                    handleUpdate(
                      "numDoc",
                      formatDocument(e.target.value, data.tipoDoc || ""),
                    );
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
                    required={isDniOrNie}
                    label={t("forms.doc_support")}
                    fullWidth
                    value={data.soporteDoc ?? ""}
                    onChange={(e) => {
                      handleUpdate("soporteDoc", e.target.value.toUpperCase());
                      clearError("soporteDoc");
                    }}
                    error={!!errors.soporteDoc}
                    sx={inputSx}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <Tooltip
                            title={isMobile ? "" : t("forms.doc_support_hint")}
                            arrow
                            placement="top"
                          >
                            <Box
                              onClick={(e) => {
                                e.stopPropagation();
                                setHelpOpen(true);
                              }}
                              sx={{
                                display: "flex",
                                cursor: "pointer",
                                color: "var(--primary)",
                                p: 0.5,
                              }}
                            >
                              <Icon name="info" size={18} />
                            </Box>
                          </Tooltip>
                        </InputAdornment>
                      ),
                    }}
                  />
                  <FieldError msg={errors.soporteDoc} />
                </div>
              )}
            </Box>
            {duplicateError && (
              <Box sx={{ mt: 1 }}>
                <Alert variant="err">{duplicateError}</Alert>
              </Box>
            )}
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
            <Button
              variant="primary"
              type="submit"
              iconRight="right"
              style={{ flex: 1, minWidth: "200px" }}
            >
              {t("common.continue")}
            </Button>
          </div>
        </fieldset>
      </form>

      <Dialog
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        PaperProps={{ sx: { borderRadius: "16px", p: 2, maxWidth: 320 } }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 1,
          }}
        >
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {t("forms.doc_support")}
          </Typography>
          <Box
            onClick={() => setHelpOpen(false)}
            sx={{
              cursor: "pointer",
              opacity: 0.5,
              transform: "rotate(45deg)",
              display: "flex",
            }}
          >
            <Icon name="plus" size={20} />
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t("forms.doc_support_hint")}
        </Typography>
        <Button
          variant="primary"
          onClick={() => setHelpOpen(false)}
          style={{ marginTop: "16px", width: "100%" }}
        >
          {t("common.continue")}
        </Button>
      </Dialog>
    </>
  );};
// --- COMPONENTE 2: DATOS DE CONTACTO ---
type PrefixItem = { code: string; dial: string; nameTranslated: string };
export const ScreenFormContacto: React.FC = () => {
  const { state, nav, actions, isSubmitting, handlePartialSubmit } =
    useCheckinContext();
  const guestIndex = nav.guestIndex;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const data = useMemo(
    () => state.guests[guestIndex] ?? {},
    [state.guests, guestIndex],
  );
  const { t, i18n } = useTranslation();
const handleUpdate = useCallback(
    (key: keyof PartialGuestData, value: unknown) =>
      actions.updateGuest(guestIndex, key, value),
    [actions, guestIndex],
  );

  // CORRECCIÓN: lockedFields solo aplica al titular (guestIndex===0).
  // Los acompañantes no tienen datos previos — sus campos no deben bloquearse.
  const lockedFields = useMemo(
    () => ({
      email: guestIndex === 0 ? !!state.knownGuest?.email : false,
      telefono: guestIndex === 0 ? !!state.knownGuest?.telefono : false,
    }),
    [state.knownGuest, guestIndex],
  );

  const contactoValidator = useCallback(
    (d: PartialGuestData, tf: TFunction) =>
      validateContacto(d, tf, d.esMenor ? { email: true, telefono: true } : lockedFields),
    [lockedFields],
  );
  const { errors, validate, clearError } = useFormValidation(contactoValidator);

  const { buscarCP, isSearching } = useZipCode((key, val) =>
    handleUpdate(key as keyof PartialGuestData, val),
  );
  const { sugerenciasProvincias, sugerenciasMunicipios, cargarMunicipios } =
    usePlaces();

  const esEspana = data.pais === "ES" || data.pais === "ESP";

  const [anchorElPrefijo, setAnchorElPrefijo] = useState<null | HTMLElement>(
    null,
  );
  const [anchorElPais, setAnchorElPais] = useState<null | HTMLElement>(null);
  const [prefijoModalOpen, setPrefijoModalOpen] = useState(false);
  const [paisModalOpen, setPaisModalOpen] = useState(false);
  const [prefijoSearch, setPrefijoSearch] = useState("");
  const [paisSearch, setPaisSearch] = useState("");

  const traducirPais = useCallback(
    (codigo: string) => {
      if (!codigo) return "";
      const iso2 = codigo.substring(0, 2).toUpperCase();
      const key = `constants.paises.${iso2}`;
      const translation = t(key);
      if (translation && !translation.includes("constants.paises"))
        return translation;
      try {
        const displayNames = new Intl.DisplayNames(
          [i18n.language.split("-")[0]],
          { type: "region" },
        );
        return displayNames.of(codigo.toUpperCase()) || codigo;
      } catch {
        return codigo;
      }
    },
    [t, i18n.language],
  );

  const prefijosTraducidos = useMemo(() => {
    return PREFIJOS_TELEFONICOS.map((c) => ({
      ...c,
      nameTranslated: traducirPais(c.code),
    })).sort((a, b) =>
      a.nameTranslated.localeCompare(b.nameTranslated, i18n.language),
    );
  }, [traducirPais, i18n.language]);

  const prefijoActual = useMemo(
    () =>
      prefijosTraducidos.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p) => p.dial === ((data as any).prefijo || "+34"),
      ) || prefijosTraducidos.find((p) => p.code === "ES"),
    [prefijosTraducidos, data],
  );

  const nombrePaisActual = useMemo(
    () => traducirPais(data.pais || "ESP"),
    [data.pais, traducirPais],
  );
  const iso2Bandera = (data.pais || "ES").substring(0, 2).toLowerCase();

  const prefijosFiltrados = useMemo(
    () =>
      prefijosTraducidos.filter(
        (c) =>
          c.nameTranslated
            .toLowerCase()
            .includes(prefijoSearch.toLowerCase()) ||
          c.dial.includes(prefijoSearch),
      ),
    [prefijosTraducidos, prefijoSearch],
  );

  const paisesFiltrados = useMemo(
    () =>
      prefijosTraducidos.filter((c) =>
        c.nameTranslated.toLowerCase().includes(paisSearch.toLowerCase()),
      ),
    [prefijosTraducidos, paisSearch],
  );
// (data.pais se inicializa a "ES" en el reducer al crear el guest,
  //  por eso ya no hacen falta este useEffect ni fallbacks aquí.)

  // --- 🔥 DEBOUNCES PARA VALIDACIÓN Y BÚSQUEDA ---
  useDebounce(
    () => {
      if (!data.esMenor && data.email?.includes("@")) validate(data);
    },
    600,
    [data.email, data.esMenor],
  );
  useDebounce(
    () => {
      if (!data.esMenor && (data.telefono?.length ?? 0) >= 7) validate(data);
    },
    600,
    [data.telefono, data.esMenor],
  );

  // Búsqueda unificada de CP
  useDebounce(
    () => {
      if (data.cp && data.pais) {
        if (esEspana && data.cp.length < 5) {
          if (data.cp.length === 2) buscarCP(data.cp, data.pais);
          return;
        }
        if (!esEspana && data.cp.length < 3) return;
        buscarCP(data.cp, data.pais);
      }
    },
    1000,
    [data.cp, data.pais, esEspana],
  );
  useEffect(() => {
    const handleForceValidate = () => validate(data);
    window.addEventListener("FORCE_VALIDATE", handleForceValidate);
    return () =>
      window.removeEventListener("FORCE_VALIDATE", handleForceValidate);
  }, [data, validate]);
const RenderList = (
    onSelect: (c: PrefixItem) => void,
    searchVal: string,
    setSearchVal: (v: string) => void,
    filtered: PrefixItem[],
    placeholderText: string,
    showDial: boolean,
  ) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: isMobile ? "100%" : 320,
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          position: "sticky",
          top: 0,
          bgcolor: "#fff",
          zIndex: 10,
        }}
      >
        <TextField
          fullWidth
          placeholder={placeholderText}
          size="small"
          autoFocus
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: "12px",
              bgcolor: "var(--bg)",
            },
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Icon name="search" size={16} />
              </InputAdornment>
            ),
          }}
        />
      </Box>
      <Box sx={{ overflowY: "auto", maxHeight: isMobile ? "60vh" : 400, p: 1 }}>
        {filtered.map((c) => (
          <MenuItem
            key={c.code}
            onClick={() => onSelect(c)}
            sx={{ gap: 2, borderRadius: "10px", py: 1.5, mb: 0.5 }}
          >
            <img
              width="22"
              loading="lazy"
              src={`https://flagcdn.com/w20/${c.code.substring(0, 2).toLowerCase()}.png`}
              alt=""
              style={{ borderRadius: "2px", flexShrink: 0 }}
            />
            <Typography
              sx={{
                flexGrow: 1,
                fontSize: "0.95rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {c.nameTranslated}
            </Typography>
            {showDial && c.dial && (
              <Typography
                sx={{
                  fontSize: "0.85rem",
                  color: "text.secondary",
                  fontWeight: 600,
                }}
              >
                {c.dial}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Box>
    </Box>
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
        <Typography variant="body2" color="var(--text-low)">
          {t("forms.guest_counter", {
            current: guestIndex + 1,
            total: state.numPersonas,
          })}
        </Typography>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (validate(data)) actions.nextGuest(guestIndex, "form_contacto");
        }}
        noValidate
      >
        <fieldset
          disabled={isSubmitting}
          style={{ border: "none", padding: 0, margin: 0 }}
        >
          <Box
            sx={{
              mt: 2,
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              px: "var(--px)",
            }}
          >
            {!data.esMenor && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  gap: 2,
                }}
              >
                <TextField
                  label={t("forms.email")}
                  fullWidth
                  value={data.email ?? ""}
                  error={!!errors.email}
                  onChange={(e) => {
                    handleUpdate("email", e.target.value);
                    clearError("email");
                  }}
                  sx={inputSx}
                />
                <TextField
                  label={t("forms.phone")}
                  fullWidth
                  type="tel"
                  value={data.telefono ?? ""}
                  error={!!errors.telefono}
                  onChange={(e) => {
                    handleUpdate(
                      "telefono",
                      formatPhoneNumber(e.target.value.replace(/\D/g, "")),
                    );
                    clearError("telefono");
                  }}
                  sx={inputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={{ mr: 1 }}>
                        <Box
                          onClick={(e) =>
                            isMobile
                              ? setPrefijoModalOpen(true)
                              : setAnchorElPrefijo(e.currentTarget)
                          }
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                            cursor: "pointer",
                            px: 1,
                            py: 0.5,
                            borderRadius: "8px",
                          }}
                        >
                          <img
                            width="20"
                            src={`https://flagcdn.com/w20/${prefijoActual?.code.substring(0, 2).toLowerCase()}.png`}
                            alt=""
                            style={{ borderRadius: "2px" }}
                          />
                          <Typography
                            sx={{ fontSize: "0.9rem", fontWeight: 700 }}
                          >
                            {prefijoActual?.dial}
                          </Typography>
                          <div
                            style={{
                              transform: "rotate(90deg)",
                              display: "flex",
                              opacity: 0.5,
                              marginLeft: 2,
                            }}
                          >
                            <Icon name="right" size={12} />
                          </div>
                        </Box>
                        <Divider
                          sx={{ height: 24, ml: 1 }}
                          orientation="vertical"
                        />
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            <TextField
              label={t("forms.address")}
              fullWidth
              value={data.direccion ?? ""}
              onChange={(e) => {
                handleUpdate("direccion", e.target.value);
                clearError("direccion");
              }}
              error={!!errors.direccion}
              sx={inputSx}
            />
            <Divider
              sx={{ my: 1, typography: "overline", color: "var(--text-low)" }}
            >
              {t("forms.location")}
            </Divider>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
              }}
            >
              <TextField
                label={t("forms.country")}
                required
                fullWidth
                value={nombrePaisActual}
                onClick={(e) =>
                  isMobile
                    ? setPaisModalOpen(true)
                    : setAnchorElPais(e.currentTarget)
                }
                sx={{
                  ...inputSx,
                  cursor: "pointer",
                  "& .MuiInputBase-input": {
                    cursor: "pointer",
                    caretColor: "transparent",
                  },
                }}
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <img
                        width="20"
                        src={`https://flagcdn.com/w20/${iso2Bandera}.png`}
                        alt=""
                        style={{ borderRadius: "2px" }}
                      />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <div
                        style={{
                          transform: "rotate(90deg)",
                          display: "flex",
                          opacity: 0.5,
                        }}
                      >
                        <Icon name="right" size={14} />
                      </div>
                    </InputAdornment>
                  ),
                }}
              />

              {/* CP: AQUÍ ESTÁ LA LÓGICA TÉCNICA CLAVE */}
              <TextField
                label={t("forms.zipcode")}
                fullWidth
                value={data.cp ?? ""}
                error={!!errors.cp}
                sx={inputSx}
                onChange={(e) => {
                  const val = e.target.value.toUpperCase();
                  handleUpdate("cp", val);
                  clearError("cp");
                }}
                onBlur={() => {
                  if (data.cp && data.pais) buscarCP(data.cp, data.pais);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (data.cp && data.pais) buscarCP(data.cp, data.pais);
                  }
                }}
                InputProps={{
                  endAdornment: isSearching ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} thickness={5} />
                    </InputAdornment>
                  ) : null,
                }}
              />
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
                    value={data.provincia || null}
                    onChange={(_, n) => {
                      handleUpdate("provincia", n || "");
                      clearError("provincia");
                    }}
                    onInputChange={(_, n) => {
                      handleUpdate("provincia", n || "");
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
                    onChange={(e) => handleUpdate("provincia", e.target.value)}
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
                    value={data.ciudad || null}
                    onChange={(_, n) => {
                      handleUpdate("ciudad", n || "");
                      clearError("ciudad");
                    }}
                    onInputChange={(_, n) => {
                      handleUpdate("ciudad", n || "");
                      cargarMunicipios(n || "", data.provincia);
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
                    onChange={(e) => handleUpdate("ciudad", e.target.value)}
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
            {guestIndex === 0 && (
              <Button
                variant="secondary"
                onClick={handlePartialSubmit}
                style={{ flex: 1, minWidth: "200px" }}
              >
                {t("common.save_partial")}
              </Button>
            )}
            <Button
              variant="primary"
              type="submit"
              iconRight="right"
              style={{ flex: 1, minWidth: "200px" }}
            >
              {guestIndex < state.numPersonas - 1
                ? t("common.next_guest")
                : t("common.continue")}
            </Button>
          </div>
        </fieldset>
      </form>

      {/* MODALES Y MENÚS */}
      <Dialog
        open={prefijoModalOpen}
        onClose={() => setPrefijoModalOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: modalPaperSx }}
      >
        {RenderList(
          (c) => {handleUpdate("prefijo", c.dial);
            setPrefijoModalOpen(false);
            setPrefijoSearch("");
          },
          prefijoSearch,
          setPrefijoSearch,
          prefijosFiltrados,
          t("search.phone_prefix_placeholder"),
          true,
        )}
      </Dialog>
      <Dialog
        open={paisModalOpen}
        onClose={() => setPaisModalOpen(false)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: modalPaperSx }}
      >
        {RenderList(
          (c) => {
            handleUpdate("pais", c.code);
            setPaisModalOpen(false);
            setPaisSearch("");
          },
          paisSearch,
          setPaisSearch,
          paisesFiltrados,
          t("search.country_placeholder"),
          false,
        )}
      </Dialog>
      <Menu
        anchorEl={anchorElPrefijo}
        open={Boolean(anchorElPrefijo)}
        onClose={() => setAnchorElPrefijo(null)}
        PaperProps={{ sx: menuPaperSx }}
      >
        {RenderList(
          (c) => {handleUpdate("prefijo", c.dial);
            setAnchorElPrefijo(null);
            setPrefijoSearch("");
          },
          prefijoSearch,
          setPrefijoSearch,
          prefijosFiltrados,
          t("search.phone_prefix_placeholder"),
          true,
        )}
      </Menu>
      <Menu
        anchorEl={anchorElPais}
        open={Boolean(anchorElPais)}
        onClose={() => setAnchorElPais(null)}
        PaperProps={{ sx: menuPaperSx }}
      >
        {RenderList(
          (c) => {
            handleUpdate("pais", c.code);
            setAnchorElPais(null);
            setPaisSearch("");
          },
          paisSearch,
          setPaisSearch,
          paisesFiltrados,
          t("search.country_placeholder"),
          false,
        )}
      </Menu>
    </>
  );
};