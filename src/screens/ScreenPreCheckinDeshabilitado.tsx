import React from "react";
import { Button, Icon } from "@/components/ui";
import { Typography, Box } from "@mui/material";

interface Props {
  motivo?: string;
  onBack: () => void;
}

export const ScreenPrecheckinDeshabilitado: React.FC<Props> = ({
  motivo,
  onBack,
}) => {
  return (
    <div
      className="screen"
      style={{
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Box sx={{ p: 4 }}>
        <div
          style={{
            backgroundColor: "var(--primary-lt)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          <Icon name="lock" size={40} color="var(--primary)" />
        </div>

        <Typography
          variant="h4"
          sx={{ fontFamily: "Cormorant Garamond, serif", mb: 2 }}
        >
          Pre-check-in no disponible
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, lineHeight: 1.6 }}
        >
          {motivo ||
            "Por razones de seguridad o políticas del alojamiento, esta reserva requiere una gestión presencial."}
          <br />
          <br />
          Por favor, **diríjase al mostrador de recepción** donde nuestro equipo
          le ayudará a completar su registro en pocos minutos.
        </Typography>

        <Alert variant="info" style={{ textAlign: "left", marginBottom: 32 }}>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li>Es posible que falte un pago pendiente.</li>
            <li>Su habitación requiere una verificación especial.</li>
            <li>El registro ya ha sido completado previamente.</li>
          </ul>
        </Alert>

        <Button variant="secondary" onClick={onBack} fullWidth>
          Volver al inicio
        </Button>
      </Box>
    </div>
  );
};
