import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, LoadingSpinner, Icon } from "@/components/ui";
import { getBookingById } from "@/api/bookings.service";
import type { Reserva } from "@/types";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buscar = async (e?: React.SyntheticEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();

    const trimmedNum = num.trim();

    if (!trimmedNum) {
      setError(t("search.error_no_booking"));
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
    <form className="screen" onSubmit={buscar} style={{ position: "relative" }}>
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
                    fontSize: 20,
                    textAlign: "center",
                    height: 64,
                    letterSpacing: ".06em",
                    marginBottom: 16,
                  }}
                />
              </Field>

              <p
                style={{
                  fontSize: 13,
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
