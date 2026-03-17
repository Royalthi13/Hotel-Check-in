import React from 'react';
import { Field, Button, Alert, ConfirmBlock, Icon } from '@/components/ui';
import { ReservationCard } from '@/components/ui';
import { HORAS_LLEGADA } from '@/constants';
import type { CheckinState } from '@/types';

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
  <>
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
  </>
);

// ═══════════════════════════════════════════════════════════════════════════
// REVISION
// ═══════════════════════════════════════════════════════════════════════════
interface RevisionProps {
  state: CheckinState;
  isSubmitting: boolean;
  onEditStep: (step: string) => void;
  // ✅ Tipado correcto: async porque hace fetch al backend
  onSubmit: () => Promise<void>;
  onRgpdChange: (v: boolean) => void;
}

export const ScreenRevision: React.FC<RevisionProps> = ({
  state, isSubmitting, onEditStep, onSubmit, onRgpdChange,
}) => {
  const { reserva, guests, horaLlegada, observaciones, rgpdAcepted } = state;
  const main = guests[0] ?? {};

  const fullName = (g: typeof main) =>
    [g.nombre, g.apellido, g.apellido2].filter(Boolean).join(' ');

  return (
    <>
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

        {guests.map((g, idx) => (
          <React.Fragment key={idx}>
            <ConfirmBlock
              title={idx === 0
                ? 'Huésped principal — datos personales'
                : `Acompañante ${idx + 1} — datos personales`}
              onEdit={() => onEditStep('form_personal')}
              rows={((): Array<[string, string | undefined | null]> => ([
                ['Nombre',       fullName(g)        || null],
                ['Sexo',         g.sexo             ?? null],
                ['Nacimiento',   g.fechaNac          ?? null],
                ['Nacionalidad', g.nacionalidad     ?? null],
                ...(g.esMenor && (g.relacionesConAdultos ?? []).length > 0
                  ? (g.relacionesConAdultos ?? []).map(r => {
                      const label = `Relación con adulto ${r.adultoIndex + 1}`;
                      const value = (r.parentesco ?? '').trim() ? r.parentesco : '—';
                      const row: [string, string] = [label, value];
                      return row;
                    })
                  : []
                ),
              ]))()}
            />
            <ConfirmBlock
              title={idx === 0
                ? 'Huésped principal — documento'
                : `Acompañante ${idx + 1} — documento`}
              onEdit={() => onEditStep('form_documento')}
              rows={[
                ['Tipo',   g.tipoDoc    ?? null],
                ['Número', g.numDoc     ?? null],
                ...(g.vat ? [['VAT', g.vat] as [string, string]] : []),
                ['Foto',   g.docUploaded ? '✓ Adjuntada' : '—'],
              ]}
            />
          </React.Fragment>
        ))}

        <ConfirmBlock
          title="Contacto y dirección"
          onEdit={() => onEditStep('form_contacto')}
          rows={[
            ['Email',     main.email    ?? null],
            ['Teléfono',  main.telefono ?? null],
            ['Dirección', [main.direccion, main.ciudad, main.provincia, main.cp, main.pais]
              .filter(Boolean).join(', ') || null],
          ]}
        />

        {(horaLlegada || observaciones) && (
          <ConfirmBlock
            title="Preferencias"
            onEdit={() => onEditStep('form_extras')}
            rows={[
              ['Llegada', horaLlegada   || null],
              ['Notas',   observaciones || null],
            ]}
          />
        )}
      </div>

      {/* RGPD persiste en estado global — sobrevive a navegar atrás y volver */}
      <div className="chk-area">
        <input
          type="checkbox"
          id="chk-accept"
          checked={rgpdAcepted ?? false}
          onChange={e => onRgpdChange(e.target.checked)}
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
          iconRight={isSubmitting ? undefined : 'check'}
          onClick={onSubmit}
          disabled={!rgpdAcepted || isSubmitting}
        >
          {isSubmitting
            ? (
              <>
                <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Enviando…
              </>
            )
            : 'Completar pre check-in'
          }
        </Button>
        <div className="privacy">
          <Icon name="lock" size={11} /> Cifrado SSL · Datos protegidos conforme al RGPD
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ÉXITO
// ═══════════════════════════════════════════════════════════════════════════
interface ExitoProps {
  state: CheckinState;
  onAddHora?: () => void; // callback para navegar a form_extras desde App.tsx
}

export const ScreenExito: React.FC<ExitoProps> = ({ state, onAddHora }) => {
  const { reserva, guests, horaLlegada } = state;
  const main = guests[0] ?? {};
  const nombreCompleto = [main.nombre, main.apellido].filter(Boolean).join(' ');

  return (
    <>
      <div className="success-wrap">
        <div className="success-ring">
          <Icon name="checkC" size={42} color="var(--ok)" />
        </div>

        <h1 className="success-title">
          ¡Pre check-in<br />completado!
        </h1>
        <p className="success-sub">
          Sus datos han sido registrados. Al llegar al hotel, diríjase
          directamente a recepción para recoger su llave de habitación.
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
          {(state.numAdultos + state.numMenores) > 1 && (
            <div className="si-row">
              <span>Total huéspedes</span><span>{state.numAdultos + state.numMenores}</span>
            </div>
          )}
          {main.tipoDoc && (
            <div className="si-row">
              <span>Documento</span>
              <span>{main.tipoDoc} · {main.numDoc}</span>
            </div>
          )}
          {horaLlegada && horaLlegada !== 'No especificada' && (
            <div className="si-row">
              <span>Llegada prevista</span><span>{horaLlegada}</span>
            </div>
          )}
        </div>

        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Imprimir / guardar confirmación */}
          <Button
            variant="primary"
            style={{ background: 'var(--secondary)' }}
            onClick={() => window.print()}
          >
            <Icon name="check" size={16} /> Guardar / Imprimir confirmación
          </Button>

          {/* Añadir hora solo si no se especificó — usa callback de App.tsx, no history.back() */}
          {(!horaLlegada || horaLlegada === 'No especificada') && onAddHora && (
            <Button variant="secondary" iconLeft="clock" onClick={onAddHora}>
              Añadir hora de llegada
            </Button>
          )}
        </div>

        <div className="privacy" style={{ marginTop: 14 }}>
          <Icon name="info" size={11} /> Recibirá una confirmación en su email
        </div>
      </div>
    </>
  );
};