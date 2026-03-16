import React, { useState } from 'react';
import { Button, Alert, Icon } from '@/components/ui';

interface Props {
  value: number;
  onChange: (n: number) => void;
  onNext: () => void;
}

export const ScreenNumPersonas: React.FC<Props> = ({ value, onChange, onNext }) => {
  const [error, setError] = useState('');
  const MIN = 1;
  const MAX = 10;

  const decrement = () => { if (value > MIN) onChange(value - 1); };
  const increment = () => { if (value < MAX) onChange(value + 1); };

  const handleNext = () => {
    if (value < MIN || value > MAX) {
      setError('Indique entre 1 y 10 personas.');
      return;
    }
    setError('');
    onNext();
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>¿Cuántas personas se hospedan?</h2>
        <p>
          Necesitamos los datos de identificación de cada huésped mayor de edad.
          Rellenaremos un formulario por persona.
        </p>
      </div>

      <div style={{ padding: '0 24px' }}>
        <div className="stepper">
          <button
            className="stepper-btn"
            onClick={decrement}
            disabled={value <= MIN}
            aria-label="Reducir número de personas"
          >
            <Icon name="minus" size={20} />
          </button>
          <div>
            <div className="stepper-value">{value}</div>
            <div className="stepper-label">
              {value === 1 ? 'persona' : 'personas'}
            </div>
          </div>
          <button
            className="stepper-btn"
            onClick={increment}
            disabled={value >= MAX}
            aria-label="Aumentar número de personas"
          >
            <Icon name="plus" size={20} />
          </button>
        </div>

        {value === 1 && (
          <Alert variant="info">
            Solo el huésped principal. Se le pedirán datos de contacto además de los personales.
          </Alert>
        )}
        {value > 1 && (
          <Alert variant="warm" icon="info">
            Se rellenarán los datos de <strong>{value} personas</strong>. El primer formulario corresponde
            al huésped principal (incluye email y dirección); los siguientes, a los acompañantes.
          </Alert>
        )}

        <Alert variant="info" icon="info" style={{ marginTop: 8 }}>
          Los menores de edad no necesitan formulario individual; podrá indicar su información
          en el apartado del huésped principal o acompañante adulto responsable.
        </Alert>

        {error && <Alert variant="err">{error}</Alert>}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={handleNext}>
          Continuar con {value} {value === 1 ? 'persona' : 'personas'}
        </Button>
      </div>
    </div>
  );
};