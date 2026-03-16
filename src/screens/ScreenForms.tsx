import React from "react";
import { Button, Alert, Icon } from "@/components/ui";
import { useZipCode } from "@/hooks/useZipCode";
import {
  PAISES,
  NACIONALIDADES,
  TIPOS_DOCUMENTO,
  SEXOS,
  RELACIONES_MENOR,
} from "@/constants";
import {
  useFormValidation,
  validatePersonal,
  validateContacto,
  validateDocumento,
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

const inputSx = {
  "& .MuiInputBase-root": {
    borderRadius: "12px",
    backgroundColor: "#fff",
  },
  "& .MuiOutlinedInput-notchedOutline": {
    borderColor: "var(--border)",
  },
};

interface FormPersonalProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
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
}

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? (
    <span
      role="alert"
      aria-live="polite"
      className="field-err"
      style={{ display: "flex", alignItems: "center", gap: 4 }}
    >
      <Icon name="warn" size={11} /> {msg}
    </span>
  ) : null;

// ═══════════════════════════════════════════════════════════════════════════
// 1. FORM PERSONAL
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormPersonal: React.FC<FormPersonalProps> = ({
  data,
  onChange,
  guestIndex,
  totalGuests,
  isMainGuest,
  onNext,
}) => {
  const { errors, validate } = useFormValidation(validatePersonal);

  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;
  const esMenor =
    fechaNac && fechaNac.isValid()
      ? dayjs().diff(fechaNac, "years") < 18
      : false;

  const handleNext = () => {
    if (validate(data)) onNext();
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
          Datos personales
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          Huésped {guestIndex + 1} de {totalGuests}
        </Typography>
      </div>

      {/* ✅ style={{ padding }} en vez de sx={{ p: "0 var(--px)" }} — MUI no interpreta CSS vars en la prop shorthand p */}
      <Box
        style={{ padding: "0 var(--px)" }}
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
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
              label="Nombre"
              required
              fullWidth
              value={data.nombre ?? ""}
              onChange={(e) => onChange("nombre", e.target.value)}
              error={!!errors.nombre}
              sx={inputSx}
              inputProps={{
                "aria-describedby": errors.nombre ? "err-nombre" : undefined,
              }}
            />
            <FieldError msg={errors.nombre} />
          </div>
          <div>
            <TextField
              label="Primer apellido"
              required
              fullWidth
              value={data.apellido ?? ""}
              onChange={(e) => onChange("apellido", e.target.value)}
              error={!!errors.apellido}
              sx={inputSx}
              inputProps={{
                "aria-describedby": errors.apellido ? "err-apellido" : undefined,
              }}
            />
            <FieldError msg={errors.apellido} />
          </div>
        </Box>

        <TextField
          label="Segundo apellido"
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
              label="Sexo"
              required
              fullWidth
              value={data.sexo ?? ""}
              onChange={(e) => onChange("sexo", e.target.value)}
              error={!!errors.sexo}
              sx={inputSx}
            >
              {SEXOS.map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <FieldError msg={errors.sexo} />
          </div>

          <div>
            <DatePicker
              label="Fecha de nacimiento *"
              value={fechaNac}
              disableFuture
              minDate={dayjs("1900-01-01")}
              onChange={(v) =>
                onChange("fechaNac", v?.isValid() ? v.format("YYYY-MM-DD") : "")
              }
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors.fechaNac,
                  sx: inputSx,
                  inputProps: {
                    "aria-describedby": errors.fechaNac ? "err-fecha" : undefined,
                  },
                },
              }}
            />
            <FieldError msg={errors.fechaNac} />
          </div>
        </Box>

        <TextField
          select
          label="Nacionalidad"
          fullWidth
          value={data.nacionalidad ?? ""}
          onChange={(e) => onChange("nacionalidad", e.target.value)}
          sx={inputSx}
        >
          {NACIONALIDADES.map((n) => (
            <MenuItem key={n} value={n}>
              {n}
            </MenuItem>
          ))}
        </TextField>

        {isMainGuest && esMenor && (
          <Alert variant="err" style={{ margin: 0 }}>
            <strong>Acompañante adulto obligatorio.</strong> Indique abajo el
            nombre del responsable del menor.
          </Alert>
        )}

        {esMenor && isMainGuest && (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              p: 2,
              bgcolor: "var(--primary-lt)",
              borderRadius: "12px",
            }}
          >
            <div>
              <TextField
                label="Nombre del responsable"
                required
                fullWidth
                value={data.nombreMenor ?? ""}
                onChange={(e) => onChange("nombreMenor", e.target.value)}
                error={!!errors.nombreMenor}
                sx={inputSx}
              />
              <FieldError msg={errors.nombreMenor} />
            </div>
            <div>
              <TextField
                select
                label="Parentesco"
                required
                fullWidth
                value={data.relacionMenor ?? ""}
                onChange={(e) => onChange("relacionMenor", e.target.value)}
                error={!!errors.relacionMenor}
                sx={inputSx}
              >
                {RELACIONES_MENOR.map((r) => (
                  <MenuItem key={r} value={r}>
                    {r}
                  </MenuItem>
                ))}
              </TextField>
              <FieldError msg={errors.relacionMenor} />
            </div>
          </Box>
        )}
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button onClick={handleNext} iconRight="right">
          Continuar
        </Button>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. FORM CONTACTO
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormContacto: React.FC<FormContactoProps> = ({
  data,
  onChange,
  onNext,
}) => {
  const { errors, validate } = useFormValidation(validateContacto);
  const { buscarCP, isSearching } = useZipCode(onChange);
  const {
    sugerenciasProvincias,
    sugerenciasMunicipios,
    cargarProvincias,
    cargarMunicipios,
  } = usePlaces();

  const esEspana = data.pais === "España";

  const handleNext = () => {
    if (validate(data)) onNext();
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
          Contacto
        </Typography>
        <p>Datos para la confirmación del registro.</p>
      </div>

      {/* ✅ style={{ padding }} en vez de sx={{ p }} */}
      <Box
        style={{ padding: "0 var(--px)" }}
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
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
              label="Email"
              required
              fullWidth
              value={data.email ?? ""}
              onChange={(e) => onChange("email", e.target.value)}
              error={!!errors.email}
              sx={inputSx}
            />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <TextField
              label="Teléfono"
              required
              fullWidth
              value={data.telefono ?? ""}
              onChange={(e) => onChange("telefono", e.target.value)}
              error={!!errors.telefono}
              sx={inputSx}
            />
            <FieldError msg={errors.telefono} />
          </div>
        </Box>

        <TextField
          label="Dirección habitual"
          fullWidth
          value={data.direccion ?? ""}
          onChange={(e) => onChange("direccion", e.target.value)}
          sx={inputSx}
        />

        <div className="divlabel">Ubicación</div>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          <TextField
            select
            label="País"
            required
            fullWidth
            value={data.pais ?? ""}
            onChange={(e) => onChange("pais", e.target.value)}
            error={!!errors.pais}
            sx={inputSx}
          >
            {PAISES.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Código Postal"
            fullWidth
            value={data.cp ?? ""}
            onChange={(e) => onChange("cp", e.target.value.toUpperCase())}
            onBlur={() => {
              if (data.cp && data.pais) buscarCP(data.cp, data.pais);
            }}
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
              onInputChange={(_, newValue) => {
                const val = newValue || "";
                onChange("provincia", val);
                cargarProvincias(val);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Provincia" sx={inputSx} />
              )}
            />
          ) : (
            <TextField
              label="Provincia"
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
              onInputChange={(_, newValue) => {
                const val = newValue || "";
                onChange("ciudad", val);
                cargarMunicipios(val, data.provincia as string);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Ciudad" sx={inputSx} />
              )}
            />
          ) : (
            <TextField
              label="Ciudad"
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
        <Button onClick={handleNext} iconRight="right">
          Continuar
        </Button>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. FORM DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormDocumento: React.FC<FormDocumentoProps> = ({
  data,
  onChange,
  guestIndex,
  totalGuests,
  isMainGuest,
  onNext,
}) => {
  const { errors, validate } = useFormValidation(validateDocumento);
  const handleNext = () => {
    if (validate(data)) onNext();
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
          Documento
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          Identificación del huésped {guestIndex + 1} de {totalGuests}
          {isMainGuest && " (titular de la reserva)"}
        </Typography>
      </div>

      {/* ✅ style={{ padding }} en vez de sx={{ p }} */}
      <Box
        style={{ padding: "0 var(--px)" }}
        sx={{
          mt: 2,
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
        }}
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
              label="Tipo de documento"
              required
              fullWidth
              value={data.tipoDoc ?? ""}
              onChange={(e) => {
                // Limpiar el error de numDoc al cambiar el tipo —
                // el formato válido cambia según el tipo seleccionado
                onChange("tipoDoc", e.target.value);
                onChange("numDoc", "");
              }}
              error={!!errors.tipoDoc}
              sx={inputSx}
            >
              {TIPOS_DOCUMENTO.map((t) => (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              ))}
            </TextField>
            <FieldError msg={errors.tipoDoc} />
          </div>
          <div>
            <TextField
              label="Número"
              required
              fullWidth
              value={data.numDoc ?? ""}
              onChange={(e) => onChange("numDoc", e.target.value.toUpperCase())}
              error={!!errors.numDoc}
              sx={inputSx}
              inputProps={{ style: { letterSpacing: "0.06em" } }}
            />
            <FieldError msg={errors.numDoc} />
          </div>
        </Box>

        <label htmlFor={`doc-${guestIndex}`} style={{ cursor: "pointer" }}>
          <div className={`upload-area ${data.docUploaded ? "done" : ""}`}>
            <Icon
              name={data.docUploaded ? "checkC" : "upload"}
              size={24}
              color={data.docUploaded ? "var(--ok)" : "var(--text-low)"}
            />
            <p style={{ marginTop: 8, fontSize: 14, fontWeight: 500 }}>
              {data.docUploaded
                ? "Documento cargado"
                : "Subir foto del documento"}
            </p>
          </div>
          <input
            type="file"
            id={`doc-${guestIndex}`}
            hidden
            onClick={(e) => { (e.target as HTMLInputElement).value = ""; }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                onChange("docFile", e.target.files[0]);
                onChange("docUploaded", true);
              }
            }}
          />
        </label>
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button onClick={handleNext} iconRight="right">
          {guestIndex < totalGuests - 1 ? "Siguiente huésped" : "Continuar"}
        </Button>
      </div>
    </>
  );
};