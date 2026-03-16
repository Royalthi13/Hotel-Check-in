import React from 'react';
import { Button, ConfirmBlock, Alert, Icon } from '@/components/ui';
import type { PartialGuestData } from '@/types';

interface Props {
  guest: PartialGuestData;
  onConfirm: () => void;
  onEdit: () => void;
}

export const ScreenConfirmarDatos: React.FC<Props> = ({ guest, onConfirm, onEdit }) => {
  const fullName = [guest.nombre, guest.apellido, guest.apellido2]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <div className="sec-hdr">
        <h2>Sus datos registrados</h2>
        <p>
          Hemos encontrado su perfil. Compruebe que los datos son correctos
          antes de continuar.
        </p>
      </div>

      <div style={{ padding: '12px 24px 0' }}>
        <Alert variant="info">
          Si algún dato ha cambiado, pulse <strong>Editar</strong> para
          actualizarlo.
        </Alert>

        <ConfirmBlock
          title="Datos personales"
          rows={[
            ['Nombre completo', fullName || null],
            ['Sexo',            guest.sexo       ?? null],
            ['Fecha nacimiento', guest.fechaNac   ?? null],
            ['Nacionalidad',    guest.nacionalidad ?? null],
          ]}
        />

        {guest.tipoDoc && (
          <ConfirmBlock
            title="Documento de identidad"
            rows={[
              ['Tipo',   guest.tipoDoc ?? null],
              ['Número', guest.numDoc  ?? null],
            ]}
          />
        )}

        {guest.email && (
          <ConfirmBlock
            title="Contacto"
            rows={[
              ['Email',    guest.email    ?? null],
              ['Teléfono', guest.telefono ?? null],
            ]}
          />
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={onConfirm}>
          Confirmar y continuar
        </Button>
        <Button variant="secondary" iconLeft="edit" onClick={onEdit}>
          Editar datos
        </Button>
      </div>

      <div className="privacy" style={{ paddingBottom: 20 }}>
        <Icon name="lock" size={11} />
        Datos protegidos conforme al RGPD
      </div>
    </>
  );
};