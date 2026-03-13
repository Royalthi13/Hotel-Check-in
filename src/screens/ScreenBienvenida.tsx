import React from 'react';
import { Icon, ReservationCard } from '../components/ui';
import type { Reserva, GuestData } from '../types';

interface Props {
  knownGuest: GuestData | null;
  reserva: Reserva | null;
  onChooseScan: () => void;
  onChooseManual: () => void;
}

export const ScreenBienvenida: React.FC<Props> = ({
  knownGuest, reserva, onChooseScan, onChooseManual,
}) => {
  const isKnown = !!knownGuest;

  return (
    <div className="screen">
      {/* Hero */}
      <div className="hero">
        <div className="hero-eyebrow">Pre Check-in Online</div>
        <h1 className="hero-title">
          {isKnown
            ? <>Bienvenido<br />de <em>nuevo</em></>
            : <>Bienvenido a<br /><em>Lumina</em></>
          }
        </h1>
        {isKnown && knownGuest?.nombre && (
          <p style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 20, fontWeight: 400, color: '#fff',
            marginTop: 10,
          }}>
            Buenos días,{' '}
            <em style={{ color: 'var(--primary)' }}>{knownGuest.nombre}</em>
          </p>
        )}
        <p className="hero-subtitle">
          {isKnown
            ? 'Tenemos su perfil registrado. Confirme o actualice sus datos para agilizar su llegada.'
            : 'Complete su registro antes de llegar y evite esperas en recepción.'
          }
        </p>
      </div>

      {/* Reservation summary */}
      {reserva && (
        <div style={{ padding: '18px 24px 0' }}>
          <ReservationCard reserva={reserva} />
        </div>
      )}

      {/* Choice cards */}
      <div style={{ padding: '20px 24px 0' }}>
        <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 14, lineHeight: 1.5 }}>
          {isKnown
            ? '¿Cómo prefiere revisar sus datos?'
            : '¿Cómo prefiere completar su registro?'
          }
        </p>

        <div className="choice-grid">
          {/* Opción A: Escanear — siempre OPCIONAL */}
          <button className="choice-card" onClick={onChooseScan}>
            <div className="choice-icon accent">
              <Icon name="id" size={20} color="#fff" />
            </div>
            <div className="choice-card-body">
              <div className="choice-card-title">
                Escanear documento de identidad
                <span style={{
                  marginLeft: 8, fontSize: 10, fontWeight: 600,
                  background: 'var(--primary-lt)', color: 'var(--primary-d)',
                  padding: '2px 7px', borderRadius: 20, verticalAlign: 'middle',
                }}>Opcional</span>
              </div>
              <div className="choice-card-sub">
                Fotografíe su DNI o pasaporte y rellenaremos los datos automáticamente.
                Más rápido, pero no es obligatorio.
              </div>
            </div>
          </button>

          {/* Opción B: Rellenar / confirmar manualmente */}
          <button className="choice-card" onClick={onChooseManual}>
            <div className="choice-icon">
              <Icon name="user" size={20} color="#fff" />
            </div>
            <div className="choice-card-body">
              <div className="choice-card-title">
                {isKnown ? 'Revisar y confirmar mis datos' : 'Rellenar datos manualmente'}
              </div>
              <div className="choice-card-sub">
                {isKnown
                  ? 'Compruebe los datos que tenemos guardados y confírmelos o modifíquelos.'
                  : 'Introduzca su información paso a paso. Rápido y sencillo.'
                }
              </div>
            </div>
          </button>
        </div>
      </div>

      <div className="spacer" />
      <div className="privacy" style={{ paddingBottom: 24 }}>
        <Icon name="lock" size={11} />
        Cifrado SSL · Datos protegidos conforme al RGPD
      </div>
    </div>
  );
};