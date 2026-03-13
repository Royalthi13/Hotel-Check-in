import React from 'react';
import { Field, Button, Alert, Icon } from '../components/ui';
import { PAISES, NACIONALIDADES, TIPOS_DOCUMENTO, SEXOS, RELACIONES_MENOR } from '../constants';
import { useFormValidation, validatePersonal, validateContacto, validateDocumento } from '../hooks/useFormValidation';
import type { PartialGuestData } from '../types';

// ── Imports de Material UI para el calendario ──────────────────────────────
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/es'; // Formato en español

// ═══════════════════════════════════════════════════════════════════════════
// FORM PERSONAL
// ═══════════════════════════════════════════════════════════════════════════
interface FormPersonalProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
  onNext: () => void;
}

export const ScreenFormPersonal: React.FC<FormPersonalProps> = ({
  data, onChange, guestIndex, totalGuests, isMainGuest, onNext,
}) => {
  const { errors, validate } = useFormValidation(validatePersonal);

  const handleNext = () => {
    if (validate(data)) onNext();
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Datos personales</h2>
        <p>Información de identificación del huésped.</p>
      </div>

      {totalGuests > 1 && (
        <div className="guest-badge">
          <Icon name="user" size={12} />
          {isMainGuest
            ? `Huésped principal (1 de ${totalGuests})`
            : `Acompañante ${guestIndex + 1} de ${totalGuests}`
          }
        </div>
      )}

      <div className="fields" style={{ marginTop: 12 }}>
        <div className="divlabel">Nombre y apellidos</div>
        <div className="g2">
          <Field label="Nombre" required error={errors.nombre}>
            <input
              type="text"
              value={data.nombre ?? ''}
              onChange={e => onChange('nombre', e.target.value)}
              placeholder="Carlos"
              className={errors.nombre ? 'err' : ''}
            />
          </Field>
          <Field label="Primer apellido" required error={errors.apellido}>
            <input
              type="text"
              value={data.apellido ?? ''}
              onChange={e => onChange('apellido', e.target.value)}
              placeholder="García"
              className={errors.apellido ? 'err' : ''}
            />
          </Field>
        </div>
        <Field label="Segundo apellido">
          <input
            type="text"
            value={data.apellido2 ?? ''}
            onChange={e => onChange('apellido2', e.target.value)}
            placeholder="López"
          />
        </Field>

        <div className="divlabel">Datos personales</div>
        <div className="g2">
          <Field label="Sexo" required error={errors.sexo}>
            <select
              value={data.sexo ?? ''}
              onChange={e => onChange('sexo', e.target.value)}
              className={errors.sexo ? 'err' : ''}
            >
              <option value="">—</option>
              {SEXOS.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          
          {/* 🛡️ DEFENSA: MUI DatePicker Aislado */}
          <Field label="Fecha de nacimiento" required error={errors.fechaNac}>
            <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
              <DatePicker
                value={data.fechaNac ? dayjs(data.fechaNac) : null}
                onChange={(newValue) => {
                  // Mantenemos el estado agnóstico de Material UI guardando un simple string
                  const dateString = newValue ? newValue.format('YYYY-MM-DD') : '';
                  onChange('fechaNac', dateString);
                }}
                slotProps={{
                  textField: {
                    className: errors.fechaNac ? 'err' : '',
                    placeholder: 'DD/MM/AAAA',
                    // Adaptamos la altura para que coincida con tus inputs normales
                    sx: { 
                      '& .MuiInputBase-root': { height: '42px', borderRadius: '8px', fontSize: '15px' },
                      width: '100%'
                    }
                  }
                }}
              />
            </LocalizationProvider>
          </Field>
        </div>

        <Field label="Nacionalidad">
          <select value={data.nacionalidad ?? ''} onChange={e => onChange('nacionalidad', e.target.value)}>
            <option value="">Seleccionar…</option>
            {NACIONALIDADES.map(n => <option key={n}>{n}</option>)}
          </select>
        </Field>

        {isMainGuest && (
          <>
            <div className="divlabel">Acompañante menor (si aplica)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <input
                type="checkbox"
                id="menor"
                checked={!!data.tienesMenor}
                onChange={e => onChange('tienesMenor', e.target.checked)}
                style={{ width: 17, height: 17, accentColor: 'var(--primary)' }}
              />
              <label htmlFor="menor" style={{ fontSize: 13, color: 'var(--text-mid)', cursor: 'pointer' }}>
                Viaja con un menor de edad
              </label>
            </div>
            {data.tienesMenor && (
              <div className="g2">
                <Field label="Nombre del menor">
                  <input
                    type="text"
                    value={data.nombreMenor ?? ''}
                    onChange={e => onChange('nombreMenor', e.target.value)}
                    placeholder="Nombre"
                  />
                </Field>
                <Field label="Relación">
                  <select value={data.relacionMenor ?? ''} onChange={e => onChange('relacionMenor', e.target.value)}>
                    <option value="">—</option>
                    {RELACIONES_MENOR.map(r => <option key={r}>{r}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </>
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          {isMainGuest ? 'Continuar: Contacto' : 'Continuar: Documento'}
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FORM CONTACTO (solo huésped principal)
// ═══════════════════════════════════════════════════════════════════════════
interface FormContactoProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  onNext: () => void;
}

export const ScreenFormContacto: React.FC<FormContactoProps> = ({ data, onChange, onNext }) => {
  const { errors, validate } = useFormValidation(validateContacto);

  const handleNext = () => {
    if (validate(data)) onNext();
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Contacto y dirección</h2>
        <p>Datos de contacto y dirección de residencia habitual del huésped principal.</p>
      </div>

      <div className="fields" style={{ marginTop: 12 }}>
        <div className="divlabel">Información de contacto</div>
        <Field label="Email" required error={errors.email}>
          <input
            type="email"
            value={data.email ?? ''}
            onChange={e => onChange('email', e.target.value)}
            placeholder="correo@ejemplo.com"
            className={errors.email ? 'err' : ''}
          />
        </Field>
        <Field label="Número de teléfono" required error={errors.telefono}>
          <input
            type="tel"
            value={data.telefono ?? ''}
            onChange={e => onChange('telefono', e.target.value)}
            placeholder="+34 600 000 000"
            className={errors.telefono ? 'err' : ''}
          />
        </Field>

        <div className="divlabel">Dirección de residencia</div>
        <Field label="Calle, número y piso">
          <input
            type="text"
            value={data.direccion ?? ''}
            onChange={e => onChange('direccion', e.target.value)}
            placeholder="Calle Mayor, 42, 3.º A"
          />
        </Field>
        <div className="g2">
          <Field label="Ciudad">
            <input type="text" value={data.ciudad ?? ''} onChange={e => onChange('ciudad', e.target.value)} placeholder="Madrid" />
          </Field>
          <Field label="Provincia">
            <input type="text" value={data.provincia ?? ''} onChange={e => onChange('provincia', e.target.value)} placeholder="Madrid" />
          </Field>
        </div>
        <div className="g2">
          <Field label="Código postal">
            <input type="text" value={data.cp ?? ''} onChange={e => onChange('cp', e.target.value)} placeholder="28001" />
          </Field>
          <Field label="País" required error={errors.pais}>
            <select value={data.pais ?? ''} onChange={e => onChange('pais', e.target.value)} className={errors.pais ? 'err' : ''}>
              <option value="">—</option>
              {PAISES.map(p => <option key={p}>{p}</option>)}
            </select>
          </Field>
        </div>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          Continuar: Documento
        </Button>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// FORM DOCUMENTO
// ═══════════════════════════════════════════════════════════════════════════
interface FormDocumentoProps {
  data: PartialGuestData;
  onChange: (key: keyof PartialGuestData, value: unknown) => void;
  guestIndex: number;
  totalGuests: number;
  isMainGuest: boolean;
  onNext: () => void;
}

export const ScreenFormDocumento: React.FC<FormDocumentoProps> = ({
  data, onChange, guestIndex, totalGuests, isMainGuest, onNext,
}) => {
  const { errors, validate } = useFormValidation(validateDocumento);
  const isLast = guestIndex === totalGuests - 1;

  const handleNext = () => {
    if (validate(data)) onNext();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      onChange('docFile', f);
      onChange('docUploaded', true);
    }
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Documento de identidad</h2>
        <p>Información del documento oficial del huésped.</p>
      </div>

      {totalGuests > 1 && (
        <div className="guest-badge">
          <Icon name="user" size={12} />
          {isMainGuest
            ? `Huésped principal (1 de ${totalGuests})`
            : `Acompañante ${guestIndex + 1} de ${totalGuests}`
          }
        </div>
      )}

      <div className="fields" style={{ marginTop: 12 }}>
        <div className="divlabel">Datos del documento</div>
        <div className="g2">
          <Field label="Tipo de documento" required error={errors.tipoDoc}>
            <select
              value={data.tipoDoc ?? ''}
              onChange={e => onChange('tipoDoc', e.target.value)}
              className={errors.tipoDoc ? 'err' : ''}
            >
              <option value="">—</option>
              {TIPOS_DOCUMENTO.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Número de documento" required error={errors.numDoc}>
            <input
              type="text"
              value={data.numDoc ?? ''}
              onChange={e => onChange('numDoc', e.target.value)}
              placeholder="12345678A"
              className={errors.numDoc ? 'err' : ''}
            />
          </Field>
        </div>

        {isMainGuest && (
          <Field label="VAT / NIF fiscal (opcional)">
            <input
              type="text"
              value={data.vat ?? ''}
              onChange={e => onChange('vat', e.target.value)}
              placeholder="ES12345678A"
            />
          </Field>
        )}

        <div className="divlabel">Foto del documento (opcional)</div>
        <Alert variant="info" style={{ marginBottom: 10 }}>
          Adjuntar la foto del documento es <strong>opcional</strong>. Si prefiere no hacerlo,
          el personal de recepción lo verificará al llegar.
        </Alert>

        <label htmlFor={`docform-${guestIndex}`}>
          <div className={`upload-area ${data.docUploaded ? 'done' : ''}`}>
            <div className="upload-icon">
              {data.docUploaded
                ? <Icon name="checkC" size={22} color="var(--ok)" />
                : <Icon name="upload" size={22} color="var(--text-mid)" />
              }
            </div>
            <div className="upload-title">
              {data.docUploaded ? `Adjunto: ${(data.docFile as File)?.name ?? 'archivo'}` : 'Subir foto del documento'}
            </div>
            <div className="upload-sub">
              {data.docUploaded ? 'Toque para cambiar el archivo' : 'JPG, PNG o PDF · Máx. 10 MB · No obligatorio'}
            </div>
          </div>
        </label>
        <input
          id={`docform-${guestIndex}`}
          type="file"
          accept="image/*,.pdf"
          style={{ display: 'none' }}
          onChange={handleFile}
        />

        {data.docUploaded && (
          <Alert variant="ok">Documento adjuntado. Se verificará durante el check-in.</Alert>
        )}

        <Alert variant="info" icon="lock">
          Transmisión cifrada. Los documentos se eliminan tras el check-in conforme al RGPD.
        </Alert>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          {isLast
            ? 'Continuar: Preferencias'
            : `Siguiente: acompañante ${guestIndex + 2} de ${totalGuests}`
          }
        </Button>
      </div>
    </div>
  );
};