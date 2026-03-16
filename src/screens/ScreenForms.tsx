import React, { useEffect, useRef } from "react";
import { Button, Alert, Icon } from "@/components/ui";
import { useZipCode } from "@/hooks/useZipCode";
import {
  PAISES,
  NACIONALIDADES,
  TIPOS_DOCUMENTO, // Recuerda quitar "Carné de conducir" de tu archivo constants
  SEXOS,
  RELACIONES_MENOR,
} from "@/constants";
import {
  useFormValidation,
  validatePersonal,
  validateContacto,
  validateDocumento,
  validarNumeroDocumento,
} from "@/hooks/useFormValidation";
import type { PartialGuestData } from "@/types";
import { DatePicker } from "@mui/x-date-pickers";
import { TextField, MenuItem, Box, Typography, Autocomplete } from "@mui/material";
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
  modoFlujo?: "manual" | "escaneo"; // 👈 AQUÍ ESTÁ EL TIPO
}

const FieldError: React.FC<{ msg?: string }> = ({ msg }) =>
  msg ? (
    <span role="alert" aria-live="polite" className="field-err"
      style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <Icon name="warn" size={11} /> {msg}
    </span>
  ) : null;

// ═══════════════════════════════════════════════════════════════════════════
// 1. FORM PERSONAL (Limpio y correcto)
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormPersonal: React.FC<FormPersonalProps> = ({
  data, onChange, guestIndex, totalGuests, isMainGuest, onNext,
}) => {
  const { errors, validate, clearError } = useFormValidation(validatePersonal);
  
  // Cálculo dinámico de la edad
  const fechaNac = data.fechaNac ? dayjs(data.fechaNac) : null;
  const esMenor = fechaNac?.isValid() ? dayjs().diff(fechaNac, "years") < 18 : false;

  useDebounce(() => {
    if ((data.nombre?.length ?? 0) >= 2) validate(data);
  }, 500, [data.nombre]);

  useDebounce(() => {
    if ((data.apellido?.length ?? 0) >= 2) validate(data);
  }, 500, [data.apellido]);

  return (
    <>
      <div className="sec-hdr">
        <Typography variant="h2" sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: "var(--fs-2xl)" }}>
          Datos personales
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          Huésped {guestIndex + 1} de {totalGuests} {isMainGuest && "(Titular)"}
        </Typography>
      </div>

      <Box style={{ padding: "0 var(--px)" }} sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
        
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <div>
            <TextField label="Nombre" required fullWidth value={data.nombre ?? ""}
              onChange={(e) => { onChange("nombre", e.target.value); if (errors.nombre) clearError("nombre"); }}
              error={!!errors.nombre} sx={inputSx} />
            <FieldError msg={errors.nombre} />
          </div>
          <div>
            <TextField label="Primer apellido" required fullWidth value={data.apellido ?? ""}
              onChange={(e) => { onChange("apellido", e.target.value); if (errors.apellido) clearError("apellido"); }}
              error={!!errors.apellido} sx={inputSx} />
            <FieldError msg={errors.apellido} />
          </div>
        </Box>

        <TextField label="Segundo apellido" fullWidth value={data.apellido2 ?? ""}
          onChange={(e) => onChange("apellido2", e.target.value)} sx={inputSx} />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <div>
            <TextField select label="Sexo" required fullWidth value={data.sexo ?? ""}
              onChange={(e) => { onChange("sexo", e.target.value); clearError("sexo"); }}
              error={!!errors.sexo} sx={inputSx}>
              {SEXOS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <FieldError msg={errors.sexo} />
          </div>
          <div>
            <DatePicker label="Fecha de nacimiento *" value={fechaNac} disableFuture
              minDate={dayjs("1900-01-01")}
              onChange={(v) => { onChange("fechaNac", v?.isValid() ? v.format("YYYY-MM-DD") : ""); clearError("fechaNac"); }}
              slotProps={{ textField: { fullWidth: true, error: !!errors.fechaNac, sx: inputSx } }}
            />
            <FieldError msg={errors.fechaNac} />
          </div>
        </Box>

        {isMainGuest && esMenor && (
          <Alert variant="err" style={{ margin: 0 }}>
            <strong>Acción no permitida.</strong> El titular de la reserva no puede ser menor de edad. Por favor, introduzca los datos de un adulto primero.
          </Alert>
        )}

        {!isMainGuest && esMenor && (
          <Box sx={{ p: 2, bgcolor: "var(--primary-lt)", borderRadius: "12px", border: "1px solid var(--border)" }}>
            <Typography variant="subtitle2" sx={{ mb: 2, color: "var(--text-main)" }}>
              Datos del menor acompañante
            </Typography>
            <TextField select label="Parentesco con el titular" required fullWidth value={data.relacionMenor ?? ""}
              onChange={(e) => { onChange("relacionMenor", e.target.value); clearError("relacionMenor"); }}
              error={!!errors.relacionMenor} sx={inputSx}>
              {RELACIONES_MENOR.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <FieldError msg={errors.relacionMenor} />
          </Box>
        )}

        {!esMenor && (
          <TextField select label="Nacionalidad" fullWidth value={data.nacionalidad ?? ""}
            onChange={(e) => onChange("nacionalidad", e.target.value)} sx={inputSx}>
            {NACIONALIDADES.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
          </TextField>
        )}

      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button 
          disabled={isMainGuest && esMenor} 
          onClick={() => { if (validate(data)) onNext(); }} 
          iconRight="right"
        >
          Continuar
        </Button>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. FORM CONTACTO (Sin Cambios)
// ═══════════════════════════════════════════════════════════════════════════
export const ScreenFormContacto: React.FC<FormContactoProps> = ({
  data, onChange, onNext,
}) => {
  const { errors, validate, clearError } = useFormValidation(validateContacto);
  const { buscarCP, isSearching } = useZipCode(onChange);
  const { sugerenciasProvincias, sugerenciasMunicipios, cargarProvincias, cargarMunicipios } = usePlaces();
  const esEspana = data.pais === "España";

  useDebounce(() => {
    if (data.email && data.email.includes("@")) validate(data);
  }, 500, [data.email]);

  useDebounce(() => {
    if ((data.telefono?.length ?? 0) >= 7) validate(data);
  }, 500, [data.telefono]);

  return (
    <>
      <div className="sec-hdr">
        <Typography variant="h2" sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: "var(--fs-2xl)" }}>
          Contacto
        </Typography>
        <p>Datos para la confirmación del registro.</p>
      </div>

      <Box style={{ padding: "0 var(--px)" }} sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <div>
            <TextField label="Email" required fullWidth value={data.email ?? ""}
              onChange={(e) => { onChange("email", e.target.value); if (errors.email) clearError("email"); }}
              error={!!errors.email} sx={inputSx} />
            <FieldError msg={errors.email} />
          </div>
          <div>
            <TextField label="Teléfono" required fullWidth value={data.telefono ?? ""}
              onChange={(e) => { onChange("telefono", e.target.value); if (errors.telefono) clearError("telefono"); }}
              error={!!errors.telefono} sx={inputSx} />
            <FieldError msg={errors.telefono} />
          </div>
        </Box>

        <TextField label="Dirección habitual" fullWidth value={data.direccion ?? ""}
          onChange={(e) => onChange("direccion", e.target.value)} sx={inputSx} />

        <div className="divlabel">Ubicación</div>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <TextField select label="País" required fullWidth value={data.pais ?? ""}
            onChange={(e) => { onChange("pais", e.target.value); clearError("pais"); }}
            error={!!errors.pais} sx={inputSx}>
            {PAISES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
          <TextField label="Código Postal" fullWidth value={data.cp ?? ""}
            onChange={(e) => onChange("cp", e.target.value.toUpperCase())}
            onBlur={() => {
              if (data.cp && data.pais) buscarCP(data.cp, data.pais);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (data.cp && data.pais) {
                  buscarCP(data.cp, data.pais);
                }
              }
            }}
            sx={inputSx}
            InputProps={{ endAdornment: isSearching ? "⏳" : null }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          {esEspana ? (
            <Autocomplete freeSolo autoHighlight options={sugerenciasProvincias || []} value={data.provincia || ""}
              onInputChange={(_, v) => { onChange("provincia", v || ""); cargarProvincias(v || ""); }}
              renderInput={(p) => <TextField {...p} label="Provincia" sx={inputSx} />} />
          ) : (
            <TextField label="Provincia" fullWidth value={data.provincia ?? ""}
              onChange={(e) => onChange("provincia", e.target.value)} sx={inputSx} />
          )}

          {esEspana ? (
            <Autocomplete freeSolo autoHighlight
              options={(sugerenciasMunicipios || []).map((m) => m.nombre)}
              value={data.ciudad || ""}
              onInputChange={(_, v) => { onChange("ciudad", v || ""); cargarMunicipios(v || "", data.provincia as string); }}
              renderInput={(p) => <TextField {...p} label="Ciudad" sx={inputSx} />} />
          ) : (
            <TextField label="Ciudad" fullWidth value={data.ciudad ?? ""}
              onChange={(e) => onChange("ciudad", e.target.value)} sx={inputSx} />
          )}
        </Box>
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button onClick={() => { if (validate(data)) onNext(); }} iconRight="right">Continuar</Button>
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
  modoFlujo,
  data, onChange, guestIndex, totalGuests, isMainGuest, onNext,
}) => {
  const { errors, validate, clearError } = useFormValidation(validateDocumento);


  useDebounce(() => {
    if (!data.tipoDoc || !data.numDoc) return;
    const minLen: Record<string, number> = {
      DNI: 9, NIF: 9, NIE: 9, Pasaporte: 6, CIF: 9, "Carnet de conducir": 8, Otro: 4,
    };
    const min = minLen[data.tipoDoc] ?? 4;
    if ((data.numDoc.length ?? 0) < min) return;

    const errorMsg = validarNumeroDocumento(data.tipoDoc, data.numDoc);
    if (errorMsg) {
      validate(data);
    } else {
      clearError("numDoc");
    }
  }, 500, [data.numDoc, data.tipoDoc]);

  const mostrarCargaFoto = modoFlujo !== "manual";

  return (
    <>
      <div className="sec-hdr">
        <Typography variant="h2" sx={{ fontFamily: "Cormorant Garamond, serif", fontSize: "var(--fs-2xl)" }}>
          Documento
        </Typography>
        <Typography variant="body2" color="var(--text-low)">
          Identificación del huésped {guestIndex + 1} de {totalGuests}
          {isMainGuest && " (titular de la reserva)"}
        </Typography>
      </div>

      <Box style={{ padding: "0 var(--px)" }} sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 2.5 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
          <div>
            <TextField select label="Tipo de documento" required fullWidth value={data.tipoDoc ?? ""}
              onChange={(e) => {
                onChange("tipoDoc", e.target.value);
                onChange("numDoc", ""); 
                clearError("tipoDoc");
                clearError("numDoc");
              }}
              error={!!errors.tipoDoc} sx={inputSx}>
              {TIPOS_DOCUMENTO.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
            </TextField>
            <FieldError msg={errors.tipoDoc} />
          </div>
          <div>
            <TextField label="Número" required fullWidth value={data.numDoc ?? ""}
              onChange={(e) => {
                onChange("numDoc", e.target.value.toUpperCase());
                if (errors.numDoc) clearError("numDoc");
              }}
              error={!!errors.numDoc} sx={inputSx}
              inputProps={{ style: { letterSpacing: "0.06em" } }}
              placeholder={
                data.tipoDoc === "DNI" || data.tipoDoc === "NIF" ? "12345678M" :
                data.tipoDoc === "NIE" ? "X1234567Z" :
                data.tipoDoc === "Pasaporte" ? "AAA123456" : undefined
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
              accept="image/*,.pdf"
              capture="environment"
              onClick={(e: React.MouseEvent<HTMLInputElement>) => {
                (e.target as HTMLInputElement).value = "";
              }}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const file = e.target.files?.[0];
                if (!file) return;

                if (file.size > 10485760) {
                  alert(
                    "El archivo es demasiado grande. El máximo permitido son 10 MB.",
                  );
                  e.target.value = "";
                  return;
                }

                onChange("docFile", file);
                onChange("docUploaded", true);
              }}
            />
          </label>
        )}
      </Box>

      <div className="spacer" />
      <div className="btn-row">
        <Button onClick={() => { if (validate(data)) onNext(); }} iconRight="right">
          {guestIndex < totalGuests - 1 ? "Siguiente huésped" : "Continuar"}
        </Button>
      </div>
    </>
  );
};