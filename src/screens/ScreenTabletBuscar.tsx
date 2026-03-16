import React, { useState } from 'react';
import { Field, Button, Alert, LoadingSpinner, Icon } from '@/components/ui';
import type { Reserva } from '@/types';

interface Props {
  onFound: (reserva: Reserva) => void;
}

/**
 * Pantalla de búsqueda de reserva para el quiosco del hotel (modo tablet).
 *
 * Usa fetch('/api/reservas/:id') interceptado por MSW en desarrollo.
 * En producción, la misma URL apunta al backend real sin cambiar nada aquí.
 *
 * Números de prueba disponibles en mocks/reservas-mock.ts: 78432 y 99999
 */
export const ScreenTabletBuscar: React.FC<Props> = ({ onFound }) => {
  const [num,     setNum]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const buscar = async () => {
    const trimmed = num.trim();
    if (!trimmed) { setError('Introduzca su número de reserva.'); return; }

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/reservas/${encodeURIComponent(trimmed)}`);
      const data = await res.json() as { ok: boolean; reserva?: Reserva; message?: string };

      if (!res.ok || !data.ok || !data.reserva) {
        setError(data.message ?? 'No se encontró ninguna reserva con ese número.');
        return;
      }

      onFound(data.reserva);

    } catch {
      setError('Error de conexión. Compruebe la red e inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
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