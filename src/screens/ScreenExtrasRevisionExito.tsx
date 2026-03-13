import React, { useState } from 'react';
import { Field, Button, Alert, ConfirmBlock, Icon } from '../components/ui';
import { ReservationCard } from '../components/ui';
import { HORAS_LLEGADA } from '../constants';
import type { CheckinState } from '../types';

// ═══════════════════════════════════════════════════════════════════════════
// FORM EXTRAS
// ═══════════════════════════════════════════════════════════════════════════
interface FormExtrasProps {
  horaLlegada: string;
  observaciones: string;
  onHoraChange: (v: string) => void;
  onObsChange: (v: string) => void;
  onNext: () => void;
}

export const ScreenFormExtras: React.FC<FormExtrasProps> = ({
  horaLlegada, observaciones, onHoraChange, onObsChange, onNext,
}) => (
  <div className="screen">
    <div className="sec-hdr">
      <h2>Preferencias y extras</h2>
      <p>Información adicional para personalizar su estancia. Todos los campos son opcionales.</p>
    </div>

    <div className="fields" style={{ marginTop: 12 }}>
      <div className="divlabel">Llegada</div>
      <Field label="Hora estimada de llegada">
        <select value={horaLlegada} onChange={e => onHoraChange(e.target.value)}>
          {HORAS_LLEGADA.map(h => <option key={h}>{h}</option>)}
        </select>
      </Field>

      <div className="divlabel">Peticiones especiales</div>
      <Field label="Observaciones o solicitudes">
        <textarea
          rows={4}
          value={observaciones}
          onChange={e => onObsChange(e.target.value)}
          placeholder="Habitación en planta alta, cuna para bebé, alergias, dieta especial…"
        />
      </Field>

      <Alert variant="info" style={{ marginTop: 8 }}>
        Las peticiones son orientativas. El hotel hará lo posible por atenderlas,
        aunque no pueden garantizarse de antemano.
      </Alert>
    </div>

    <div className="spacer" />
    <div className="btn-row">
      <Button variant="primary" iconRight="right" onClick={onNext}>
        Revisar y confirmar
      </Button>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// REVISION
// ═══════════════════════════════════════════════════════════════════════════
interface RevisionProps {
  state: CheckinState;
  onEditStep: (step: string) => void;
  onSubmit: () => void;
}

export const ScreenRevision: React.FC<RevisionProps> = ({ state, onEditStep, onSubmit }) => {
  const [accepted, setAccepted] = useState(false);
  const { reserva, guests, horaLlegada, observaciones } = state;
  const main = guests[0] ?? {};

  const fullName = (g: typeof main) =>
    [g.nombre, g.apellido, g.apellido2].filter(Boolean).join(' ');

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Revise sus datos</h2>
        <p>Compruebe que toda la información es correcta antes de confirmar el pre check-in.</p>
      </div>

      <div style={{ padding: '8px 24px 0' }}>
        {reserva && (
          <div style={{ marginBottom: 12 }}>
            <ReservationCard reserva={reserva} />
          </div>
        )}

        {/* Un bloque por cada huésped */}
        {guests.map((g, idx) => (
          <React.Fragment key={idx}>
            <ConfirmBlock
              title={idx === 0 ? 'Huésped principal — datos personales' : `Acompañante ${idx + 1} — datos personales`}
              onEdit={() => onEditStep('form_personal')}
              rows={[
                ['Nombre', fullName(g)],
                ['Sexo', g.sexo ?? null],
                ['Nacimiento', g.fechaNac ?? null],
                ['Nacionalidad', g.nacionalidad ?? null],
                g.tienesMenor ? ['Menor', `${g.nombreMenor ?? '—'} (${g.relacionMenor ?? '—'})`] : ['', ''],
              ]}
            />
            <ConfirmBlock
              title={idx === 0 ? 'Huésped principal — documento' : `Acompañante ${idx + 1} — documento`}
              onEdit={() => onEditStep('form_documento')}
              rows={[
                ['Tipo', g.tipoDoc ?? null],
                ['Número', g.numDoc ?? null],
                g.vat ? ['VAT', g.vat] : ['', ''],
                ['Foto', g.docUploaded ? '✓ Adjuntada' : '—'],
              ]}
            />
          </React.Fragment>
        ))}

        <ConfirmBlock
          title="Contacto y dirección"
          onEdit={() => onEditStep('form_contacto')}
          rows={[
            ['Email', main.email ?? null],
            ['Teléfono', main.telefono ?? null],
            ['Dirección', [main.direccion, main.ciudad, main.provincia, main.cp, main.pais].filter(Boolean).join(', ') || null],
          ]}
        />

        {(horaLlegada || observaciones) && (
          <ConfirmBlock
            title="Preferencias"
            onEdit={() => onEditStep('form_extras')}
            rows={[
              ['Llegada', horaLlegada || null],
              ['Notas', observaciones || null],
            ]}
          />
        )}
      </div>

      {/* Checkbox de aceptación */}
      <div className="chk-area">
        <input
          type="checkbox"
          id="chk-accept"
          checked={accepted}
          onChange={e => setAccepted(e.target.checked)}
        />
        <label htmlFor="chk-accept">
          Confirmo que los datos son correctos y acepto la{' '}
          <a href="#">política de privacidad</a> y las{' '}
          <a href="#">condiciones del pre check-in</a> del hotel.
        </label>
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          variant="primary"
          iconRight="check"
          onClick={onSubmit}
          disabled={!accepted}
        >
          Completar pre check-in
        </Button>
        <div className="privacy">
          <Icon name="lock" size={11} /> Cifrado SSL · Datos protegidos conforme al RGPD
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ÉXITO
// ═══════════════════════════════════════════════════════════════════════════
interface ExitoProps {
  state: CheckinState;
}

export const ScreenExito: React.FC<ExitoProps> = ({ state }) => {
  const { reserva, guests, horaLlegada } = state;
  const main = guests[0] ?? {};
  const nombreCompleto = [main.nombre, main.apellido].filter(Boolean).join(' ');

  return (
    <div className="screen">
      <div className="success-wrap">
        <div className="success-ring">
          <Icon name="checkC" size={42} color="var(--ok)" />
        </div>

        <h1 className="success-title">
          ¡Pre check-in<br />completado!
        </h1>
        <p className="success-sub">
          Sus datos han sido registrados. Al llegar al hotel, diríjase directamente
          a recepción para recoger su llave de habitación.
        </p>

        <div className="success-info-card">
          {reserva && (
            <>
              <div className="si-row">
                <span>Reserva</span><span>{reserva.confirmacion}</span>
              </div>
              <div className="si-row">
                <span>Habitación</span><span>{reserva.habitacion}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)' }} />
            </>
          )}
          {nombreCompleto && (
            <div className="si-row">
              <span>Huésped principal</span><span>{nombreCompleto}</span>
            </div>
          )}
          {state.numPersonas > 1 && (
            <div className="si-row">
              <span>Total huéspedes</span><span>{state.numPersonas}</span>
            </div>
          )}
          {main.tipoDoc && (
            <div className="si-row">
              <span>Documento</span><span>{main.tipoDoc} · {main.numDoc}</span>
            </div>
          )}
          {horaLlegada && horaLlegada !== 'No especificada' && (
            <div className="si-row">
              <span>Llegada prevista</span><span>{horaLlegada}</span>
            </div>
          )}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button variant="primary" style={{ background: 'var(--secondary)' }}>
            <Icon name="check" size={16} /> Finalizar
          </Button>
          <Button variant="secondary" iconLeft="clock">
            Añadir hora de llegada
          </Button>
        </div>

        <div className="privacy" style={{ marginTop: 14 }}>
          <Icon name="info" size={11} /> Recibirá una confirmación en su email
        </div>
      </div>
    </div>
  );
};