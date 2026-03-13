import React, { useState } from 'react';
import { Field, Button, Alert, LoadingSpinner, Icon } from '../components/ui';
import { MOCK_RESERVAS } from '../constants';
import type { Reserva } from '../types';

interface Props {
  onFound: (reserva: Reserva) => void;
}

export const ScreenTabletBuscar: React.FC<Props> = ({ onFound }) => {
  const [num, setNum] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const buscar = () => {
    const trimmed = num.trim();
    if (!trimmed) { setError('Introduzca su número de reserva.'); return; }
    setError('');
    setLoading(true);
    // Simula llamada al backend
    setTimeout(() => {
      setLoading(false);
      const res = MOCK_RESERVAS[trimmed];
      if (res) {
        onFound(res);
      } else {
        setError('No se encontró ninguna reserva con ese número. Compruebe el dato o solicite ayuda en recepción.');
      }
    }, 1500);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') buscar();
  };

  return (
    <div className="screen">
      <div className="tablet-hero">
        <div className="tablet-big-icon">
          <Icon name="search" size={30} color="var(--primary)" />
        </div>
        <h1 className="tablet-title">Bienvenido al<br />pre check-in</h1>
        <p className="tablet-sub">
          Introduzca su número de reserva para comenzar el proceso de check-in anticipado
        </p>
      </div>

      <div style={{ padding: '28px 24px 0', flex: 1 }}>
        {error && <Alert variant="err">{error}</Alert>}

        {loading ? (
          <LoadingSpinner text="Buscando su reserva…" />
        ) : (
          <>
            <Field label="Número de reserva" required>
              <input
                type="text"
                value={num}
                onChange={e => { setNum(e.target.value); setError(''); }}
                onKeyDown={handleKey}
                placeholder="Ej: 78432 o 99999"
                className={error ? 'err' : ''}
                autoFocus
                style={{ fontSize: 18, textAlign: 'center', height: 56, letterSpacing: '.06em' }}
              />
            </Field>
            <p style={{ fontSize: 11, color: 'var(--text-low)', textAlign: 'center', marginBottom: 20, lineHeight: 1.5 }}>
              Puede encontrar su número en el email de confirmación de la reserva
            </p>
          </>
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button
          variant="primary"
          iconRight="search"
          onClick={buscar}
          disabled={loading}
        >
          {loading ? 'Buscando…' : 'Buscar mi reserva'}
        </Button>
      </div>
      <div className="privacy">
        <Icon name="lock" size={11} />
        Datos protegidos · Conexión cifrada SSL
      </div>
      <div style={{ height: 20 }} />
    </div>
  );
};