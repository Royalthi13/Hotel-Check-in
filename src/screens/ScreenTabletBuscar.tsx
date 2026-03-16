import React, { useState } from "react";
import { Field, Button, Alert, LoadingSpinner, Icon } from "../components/ui";
import { MOCK_RESERVAS } from "../mocks/reservas-mock";
import type { Reserva } from "../types";

interface Props {
  onFound: (reserva: Reserva) => void;
}

export const ScreenTabletBuscar: React.FC<Props> = ({ onFound }) => {
  const [num, setNum] = useState("");
  const [contacto, setContacto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscar = () => {
    const trimmedNum = num.trim();
    const trimmedContacto = contacto.trim();

    if (!trimmedNum && !trimmedContacto) {
      setError(
        "Por favor, introduzca el número de reserva y su email o teléfono.",
      );
      return;
    }

    if (!trimmedNum) {
      setError("Por favor, introduzca el número de reserva.");
      return;
    }

    if (!trimmedContacto) {
      setError("Por favor, introduzca su email o número de teléfono.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{9,15}$/;

    const isEmail = emailRegex.test(trimmedContacto);
    const isPhone = phoneRegex.test(trimmedContacto);

    if (!isEmail && !isPhone) {
      const numCount = (trimmedContacto.match(/\d/g) || []).length;
      const letterCount = (trimmedContacto.match(/[a-zA-Z]/g) || []).length;

      const seemsLikeEmail =
        trimmedContacto.includes("@") || letterCount > numCount;

      if (seemsLikeEmail) {
        setError(
          "Formato de email incorrecto. Asegúrese de que incluye un '@' y un dominio (ej: nombre@email.com).",
        );
      } else {
        setError(
          "Formato de teléfono incorrecto. Elimine las letras y asegúrese de que tiene entre 9 y 15 dígitos.",
        );
      }
      return;
    }

    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      const res = MOCK_RESERVAS[trimmedNum];

      if (res) {
        onFound(res);
      } else {
        setError(
          "No se encontró ninguna reserva con esos datos. Compruebe la información o solicite ayuda.",
        );
      }
    }, 1500);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") buscar();
  };

  return (
    <div className="screen">
      <div className="tablet-hero">
        <div className="tablet-big-icon">
          <Icon name="search" size={30} color="var(--primary)" />
        </div>
        <h1 className="tablet-title">
          Bienvenido al
          <br />
          pre check-in
        </h1>
        <p className="tablet-sub">
          Introduzca su número de reserva para comenzar el proceso de check-in
          anticipado
        </p>
      </div>

      <div style={{ padding: "28px 24px 0", flex: 1 }}>
        {error && <Alert variant="err">{error}</Alert>}

        {loading ? (
          <LoadingSpinner text="Buscando su reserva…" />
        ) : (
          <>
            <Field label="Forma de contacto" required>
              <input
                type="text"
                value={contacto}
                onChange={(e) => {
                  setContacto(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKey}
                placeholder="Email o número de teléfono"
                className={
                  error && (!contacto.trim() || error.includes("Formato"))
                    ? "err"
                    : ""
                }
                style={{
                  fontSize: 18,
                  textAlign: "center",
                  height: 56,
                  letterSpacing: ".06em",
                }}
              />
            </Field>
            <Field label="Número de reserva" required>
              <input
                type="text"
                value={num}
                onChange={(e) => {
                  setNum(e.target.value);
                  setError("");
                }}
                onKeyDown={handleKey}
                placeholder="Ej: 78432 o 99999"
                className={error && !num.trim() ? "err" : ""}
                autoFocus
                style={{
                  fontSize: 18,
                  textAlign: "center",
                  height: 56,
                  letterSpacing: ".06em",
                  marginBottom: 16,
                }}
              />
            </Field>

            <p
              style={{
                fontSize: 11,
                color: "var(--text-low)",
                textAlign: "center",
                marginTop: 16,
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Puede encontrar su número en el email de confirmación de la
              reserva
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
          {loading ? "Buscando…" : "Buscar mi reserva"}
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
