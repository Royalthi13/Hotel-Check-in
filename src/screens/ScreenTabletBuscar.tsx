import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, LoadingSpinner, Icon } from "@/components/ui";
import type { Reserva } from "@/types";

interface Props {
  // Ajustado para coincidir con la llamada en App.tsx:
  // onFound={(res, bookingId, clientId) => ...}
  onFound: (
    reserva: Reserva,
    bookingId: number,
    clientId: number | null,
  ) => void;
}

/**
 * Pantalla de búsqueda de reserva para el quiosco del hotel (modo tablet).
 *
 * Usa fetch('/api/reservas/:id') para conectar con la base de datos real.
 */
export const ScreenTabletBuscar: React.FC<Props> = ({ onFound }) => {
  const { t } = useTranslation();
  const [num, setNum] = useState("");
  const [contacto, setContacto] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscar = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmedNum = num.trim();
    const trimmedContacto = contacto.trim();

    if (!trimmedNum || !trimmedContacto) {
      setError(t("search.error_no_booking"));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[\d\s-]{9,15}$/;
    const isEmail = emailRegex.test(trimmedContacto);
    const isPhone = phoneRegex.test(trimmedContacto);

    if (!isEmail && !isPhone) {
      setError(t("validation.invalid_email"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      // 1. LLAMADA A LA API REAL
      // Opcional: Si tu API necesita validar también el contacto, puedes pasarlo como query param
      // ej: `/api/reservas/${encodeURIComponent(trimmedNum)}?contacto=${encodeURIComponent(trimmedContacto)}`
      const res = await fetch(
        `/api/reservas/${encodeURIComponent(trimmedNum)}`,
      );

      const data = (await res.json()) as {
        ok: boolean;
        reserva?: Reserva;
        bookingId?: number; // Asumimos que el backend devuelve estos IDs
        clientId?: number | null;
        message?: string;
      };

      // 2. RESPUESTA EXITOSA
      if (res.ok && data.ok && data.reserva) {
        // Extraemos los IDs que necesita la app para el estado global
        const bId = data.bookingId || 0; // Ajusta esto según lo que devuelva tu API real
        const cId = data.clientId ?? null;

        onFound(data.reserva, bId, cId);
        return; // Salimos de la función sin quitar el loading para que la transición sea suave
      }

      // 3. RESPUESTA DEL BACKEND PERO CON ERROR (Ej: No encontrada)
      setError(data.message || t("search.error_no_booking"));
      setLoading(false);
    } catch (err) {
      // 4. ERROR DE RED O CAÍDA DEL SERVIDOR
      console.error("Error al buscar la reserva:", err);
      setError(t("search.error_connection")); // "Error de conexión con el servidor"
      setLoading(false);
    }
  };

  return (
    <form className="screen" onSubmit={buscar}>
      <div style={{ display: "contents" }}>
        <div className="tablet-hero">
          <div className="tablet-big-icon">
            <Icon name="search" size={30} color="var(--primary)" />
          </div>
          <h1 className="tablet-title">
            {t("search.title_1")}
            <br />
            {t("search.title_2")}
          </h1>
          <p className="tablet-sub">{t("search.subtitle")}</p>
        </div>

        <div style={{ padding: "28px 24px 0", flex: 1 }}>
          {error && <Alert variant="err">{error}</Alert>}

          {loading ? (
            <LoadingSpinner text={t("common.loading")} />
          ) : (
            <>
              <Field label={t("search.contact_label")} required>
                <input
                  type="text"
                  value={contacto}
                  onChange={(e) => {
                    setContacto(e.target.value);
                    setError("");
                  }}
                  placeholder={t("search.contact_placeholder")}
                  className={
                    error &&
                    (!contacto.trim() ||
                      error.includes("Formato") ||
                      error.includes("Invalid"))
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

              <Field label={t("search.booking_label")} required>
                <input
                  type="text"
                  value={num}
                  onChange={(e) => {
                    setNum(e.target.value);
                    setError("");
                  }}
                  placeholder={t("search.booking_placeholder")}
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
                {t("search.booking_hint")}
              </p>
            </>
          )}
        </div>

        <div className="spacer" />
        <div className="btn-row">
          <Button variant="primary" iconRight="search" disabled={loading}>
            {loading ? t("common.loading") : t("search.btn_search")}
          </Button>
        </div>

        <div className="privacy">
          <Icon name="lock" size={11} />
          {t("common.privacy_ssl")}
        </div>
        <div style={{ height: 20 }} />
      </div>
    </form>
  );
};
