import React, { useState } from 'react';
import { Button, Alert, Icon } from '@/components/ui';
import { PARENTESCOS_MENOR } from '@/constants';
import type { PartialGuestData } from '@/types';

interface Props {
  // El menor cuyos parentescos se están declarando
  menor: PartialGuestData;
  menorIndex: number;      // relativo (0 = primer menor)
  menorRealIndex: number;  // absoluto en el array guests

  // Los adultos del grupo
  adultos: PartialGuestData[];

  // Callback cuando cambia un parentesco
  onRelacionChange: (adultoIndex: number, parentesco: string) => void;

  onNext: () => void;
}

function nombreAdulto(adulto: PartialGuestData, idx: number): string {
  const nombre = [adulto.nombre, adulto.apellido].filter(Boolean).join(' ');
  return nombre || `Adulto ${idx + 1}`;
}

function nombreMenor(menor: PartialGuestData, idx: number): string {
  const nombre = [menor.nombre, menor.apellido].filter(Boolean).join(' ');
  return nombre || `Menor ${idx + 1}`;
}

export const ScreenRelacionesMenor: React.FC<Props> = ({
  menor,
  menorIndex,
  adultos,
  onRelacionChange,
  onNext,
}) => {
  const [touched, setTouched] = useState(false);

  // Verificar que todos los parentescos están rellenos
  const relaciones = menor.relacionesConAdultos ?? [];
  const todosRellenos = relaciones.length === adultos.length &&
    relaciones.every(r => r.parentesco.trim() !== '');

  const handleNext = () => {
    setTouched(true);
    if (todosRellenos) onNext();
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Relación de parentesco</h2>
        <p>
          Declare la relación de <strong>{nombreMenor(menor, menorIndex)}</strong> con
          cada adulto del grupo.
        </p>
      </div>

      <div style={{ padding: '8px 24px 0' }}>
        {/* Aviso legal */}
        <Alert variant="warm" style={{ marginBottom: 16 }}>
          <Icon name="info" size={14} />
          <span>
            <strong>Requisito legal (Orden INT/1922/2003):</strong> Los establecimientos
            hoteleros están obligados a registrar el parentesco o relación de tutela
            de los menores con los adultos acompañantes.
          </span>
        </Alert>

        {/* Un select por cada adulto */}
        {adultos.map((adulto, ai) => {
          const relacionActual = relaciones.find(r => r.adultoIndex === ai)?.parentesco ?? '';
          const sinRelacion = touched && relacionActual.trim() === '';

          return (
            <div key={ai} style={{
              marginBottom: 16,
              padding: '16px',
              background: 'var(--bg)',
              borderRadius: 12,
              border: `1.5px solid ${sinRelacion ? 'var(--err)' : 'var(--border)'}`,
            }}>
              {/* Cabecera del adulto */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: 'var(--secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="user" size={18} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                    {nombreAdulto(adulto, ai)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-low)' }}>
                    {ai === 0 ? 'Titular de la reserva' : `Adulto ${ai + 1}`}
                  </div>
                </div>
              </div>

              {/* Select de parentesco */}
              <div className="field">
                <label>
                  Relación con {nombreMenor(menor, menorIndex)}
                  <span style={{ color: 'var(--primary)', marginLeft: 2 }}>*</span>
                </label>
                <select
                  value={relacionActual}
                  onChange={e => onRelacionChange(ai, e.target.value)}
                  className={sinRelacion ? 'err' : ''}
                  style={{ height: 46 }}
                >
                  <option value="">— Seleccionar parentesco —</option>
                  {PARENTESCOS_MENOR.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {sinRelacion && (
                  <span className="field-err" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Icon name="warn" size={11} /> Este campo es obligatorio por ley
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          Continuar
        </Button>
      </div>
    </div>
  );
};