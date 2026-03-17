import React, { useState } from "react";
import { Field, Button, Alert, LoadingSpinner, Icon } from "@/components/ui";
import type { Reserva } from "@/types";
import { MOCK_RESERVAS } from "@/mocks/reservas-mock";

interface Props {
  onFound: (reserva: Reserva) => void;
}

export const ScreenTabletBuscar: React.FC<Props> = ({ onFound }) => {
  const [num, setNum] = useState("");
  const [contacto, setContacto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscar = async () => {
    const trimmedNum = num.trim();
    const trimmedContacto = contacto.trim();

    if (!trimmedNum) {
      setError("Por favor, introduzca su número de reserva.");
      return;
    }
    if (!trimmedContacto) {
      setError("Por favor, introduzca su email o teléfono de contacto.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{9,15}$/;

    const pareceEmail = trimmedContacto.includes("@");

    if (pareceEmail) {
      if (!emailRegex.test(trimmedContacto)) {
        setError(
          "El formato del email no es válido (ejemplo: usuario@email.com).",
        );
        return;
      }
    } else {
      if (!phoneRegex.test(trimmedContacto)) {
        setError(
          "El teléfono debe tener entre 9 y 15 dígitos y puede incluir el prefijo +.",
        );
        return;
      }
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch(
        `/api/reservas/${encodeURIComponent(trimmedNum)}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        reserva?: Reserva;
        message?: string;
      };

      if (res.ok && data.ok && data.reserva) {
        onFound(data.reserva);
        return;
      }

      const mockRes = MOCK_RESERVAS[trimmedNum as keyof typeof MOCK_RESERVAS];
      if (mockRes) {
        onFound(mockRes);
      } else {
        setError(
          data.message ?? "No se encontró ninguna reserva con esos datos.",
        );
      }
    } catch {
      const mockRes = MOCK_RESERVAS[trimmedNum as keyof typeof MOCK_RESERVAS];
      if (mockRes) {
        onFound(mockRes);
      } else {
        setError("Error de conexión. Por favor, inténtelo de nuevo.");
      }
    } finally {
      setLoading(false);
    }
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
