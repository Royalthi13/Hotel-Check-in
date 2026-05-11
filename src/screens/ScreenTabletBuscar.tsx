import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, LoadingSpinner, Icon } from "@/components/ui";
import { getBookingById } from "@/api/bookings.service";
import type { Reserva } from "@/types";

// 1. IMPORTANTE: Aquí importamos el componente para que React sepa qué es y no pete.
import { LanguageSelector } from "@/components/LanguageSelector";

interface Props {
  onFound: (
    reserva: Reserva,
    bookingId: number,
    clientId: number | null,
  ) => void;
}

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

    // Fix eslint: \- no necesita escape fuera de clase de caracteres
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedContacto);
    const isPhone = /^\+?[\d\s-]{6,15}$/.test(trimmedContacto);
    if (!isEmail && !isPhone) {
      setError(t("validation.invalid_email"));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const result = await getBookingById(trimmedNum);

      if (!result?.reserva) {
        setError(t("search.error_not_found"));
        return;
      }

      const { reserva, clientId, bookingId } = result;

      if (clientId) {
        const { getClientById } = await import("@/api/clients.service");
        try {
          const titular = await getClientById(clientId);
          const input = trimmedContacto.toLowerCase();
          const onlyDigits = (s: string) => s.replace(/\D/g, "");
          const emailMatch =
            !!titular.email && titular.email.trim().toLowerCase() === input;
          const inputDigits = onlyDigits(trimmedContacto);
          const phoneDigits = onlyDigits(titular.telefono ?? "");
          const phoneMatch =
            phoneDigits.length >= 3 &&
            inputDigits.length >= 3 &&
            phoneDigits.endsWith(
              inputDigits.slice(
                -Math.min(inputDigits.length, phoneDigits.length),
              ),
            );

          if (!emailMatch && !phoneMatch) {
            setError(t("search.error_not_found"));
            return;
          }
        } catch {
          if (import.meta.env.DEV) {
            console.warn(
              "[TabletBuscar] No se pudo verificar el contacto del titular",
            );
          }
        }
      }

      onFound(reserva, bookingId, clientId);
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 404) {
        setError(t("search.error_not_found"));
      } else {
        setError(t("search.error_connection"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // 2. IMPORTANTE: Añadimos style={{ position: "relative" }} al form
    <form className="screen" onSubmit={buscar} style={{ position: "relative" }}>
      {/* 3. Selector de idioma — esquina superior derecha */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <LanguageSelector />
      </div>

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
                  className={error && !contacto.trim() ? "err" : ""}
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
                  inputMode="numeric"
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
