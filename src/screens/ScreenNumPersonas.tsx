import React, { useState } from 'react';
import { Button, Alert, Icon } from '@/components/ui';

interface Props {
  numAdultos: number;
  numMenores: number;
  onChange: (adultos: number, menores: number) => void;
  onNext: () => void;
  // Cuando venga del backend, totalFijo = reserva.numHuespedes
  // El componente solo mostrará el stepper de menores y calculará adultos automáticamente
  // Por ahora es undefined (sin backend)
  totalFijo?: number;
}

const MAX_TOTAL = 10;

export const ScreenNumPersonas: React.FC<Props> = ({
  numAdultos, numMenores, onChange, onNext, totalFijo,
}) => {
  const [error, setError] = useState('');

  // ── Modo con backend: total conocido, solo preguntamos menores ────────────
  const modoReserva = totalFijo !== undefined;
  const total = modoReserva ? totalFijo : numAdultos + numMenores;
  const maxMenores = modoReserva ? totalFijo - 1 : MAX_TOTAL - numAdultos;

  const setMenores = (n: number) => {
    if (n < 0 || n > maxMenores) return;
    const adultos = modoReserva ? totalFijo - n : numAdultos;
    onChange(adultos, n);
  };

  const setAdultos = (n: number) => {
    if (n < 1 || n + numMenores > MAX_TOTAL) return;
    onChange(n, numMenores);
  };

  const handleNext = () => {
    if (!modoReserva && numAdultos < 1) {
      setError('Debe haber al menos 1 adulto.');
      return;
    }
    if (modoReserva && totalFijo - numMenores < 1) {
      setError('Debe haber al menos 1 adulto en la reserva.');
      return;
    }
    setError('');
    onNext();
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>
          {modoReserva ? 'Menores en la reserva' : 'Composición del grupo'}
        </h2>
        <p>
          {modoReserva
            ? `Su reserva es para ${totalFijo} ${totalFijo === 1 ? 'persona' : 'personas'}. ¿Cuántas son menores de 18 años?`
            : 'Indique cuántos adultos y menores de edad se hospedan.'
          }
        </p>
      </div>

      <div style={{ padding: '0 24px' }}>

        {/* ── Modo SIN backend: dos steppers ── */}
        {!modoReserva && (
          <>
            <div className="divlabel">Adultos (18 años o más)</div>
            <div className="stepper">
              <button className="stepper-btn" onClick={() => setAdultos(numAdultos - 1)}
                disabled={numAdultos <= 1} aria-label="Reducir adultos">
                <Icon name="minus" size={20} />
              </button>
              <div>
                <div className="stepper-value">{numAdultos}</div>
                <div className="stepper-label">{numAdultos === 1 ? 'adulto' : 'adultos'}</div>
              </div>
              <button className="stepper-btn" onClick={() => setAdultos(numAdultos + 1)}
                disabled={numAdultos + numMenores >= MAX_TOTAL} aria-label="Aumentar adultos">
                <Icon name="plus" size={20} />
              </button>
            </div>
          </>
        )}

        {/* ── Stepper de menores — siempre visible ── */}
        <div className="divlabel" style={{ marginTop: modoReserva ? 0 : 20 }}>
          Menores de edad (menos de 18 años)
        </div>
        <div className="stepper">
          <button className="stepper-btn" onClick={() => setMenores(numMenores - 1)}
            disabled={numMenores <= 0} aria-label="Reducir menores">
            <Icon name="minus" size={20} />
          </button>
          <div>
            <div className="stepper-value">{numMenores}</div>
            <div className="stepper-label">{numMenores === 1 ? 'menor' : 'menores'}</div>
          </div>
          <button className="stepper-btn" onClick={() => setMenores(numMenores + 1)}
            disabled={numMenores >= maxMenores} aria-label="Aumentar menores">
            <Icon name="plus" size={20} />
          </button>
        </div>

        {/* ── Resumen ── */}
        <div style={{
          margin: '20px 0 4px', padding: '14px 16px',
          background: 'var(--bg)', borderRadius: 12,
          border: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: 'var(--text-mid)' }}>
              {modoReserva ? (totalFijo - numMenores) : numAdultos}
              {' '}{(modoReserva ? totalFijo - numMenores : numAdultos) === 1 ? 'adulto' : 'adultos'}
              {numMenores > 0 && ` · ${numMenores} ${numMenores === 1 ? 'menor' : 'menores'}`}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-low)' }}>Total: {total} {total === 1 ? 'persona' : 'personas'}</span>
          </div>
        </div>

        {/* ── Alertas contextuales ── */}
        {!modoReserva && total >= MAX_TOTAL && (
          <Alert variant="info" style={{ marginTop: 8 }}>
            Máximo {MAX_TOTAL} personas por reserva online. Para grupos más grandes contacte con el hotel.
          </Alert>
        )}

        {numMenores > 0 && (
          <Alert variant="warm" style={{ marginTop: 8 }}>
            <strong>Aviso legal (Orden INT/1922/2003):</strong> Es obligatorio registrar los datos
            de identificación de los menores y su relación de parentesco o tutela con cada
            adulto del grupo.
          </Alert>
        )}

        {numMenores > 0 && (modoReserva ? totalFijo - numMenores : numAdultos) > 1 && (
          <Alert variant="info" style={{ marginTop: 8 }}>
            Se declarará la relación de {numMenores === 1 ? 'el menor' : 'cada menor'} con
            cada uno de los {modoReserva ? totalFijo - numMenores : numAdultos} adultos del grupo.
          </Alert>
        )}

        {error && <Alert variant="err" style={{ marginTop: 8 }}>{error}</Alert>}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          Continuar con {total} {total === 1 ? 'persona' : 'personas'}
        </Button>
      </div>
    </div>
  );
};