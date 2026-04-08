import React, { useState } from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook
import { Field, Button, Alert, LoadingSpinner, Icon } from "@/components/ui";
import type { Reserva } from "@/types";
import { getBookingById } from "@/api/bookings.service";
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
  const { t } = useTranslation(); // 2. Inicializamos el traductor
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
      // LLAMADA A LA API REAL USANDO AXIOS Y EL MAPEO
      const reserva = await getBookingById(trimmedNum);
      
      // Si todo va bien, pasamos la reserva mapeada hacia arriba
      onFound(reserva);

    }  catch (err) {
      // Le decimos a TypeScript qué forma esperamos que tenga el error
      const error = err as { response?: { status: number } }; 
      
      if (error.response?.status === 404) {
        setError(t("search.error_not_found"));
      } else {
        setError(t("search.error_connection"));
      }
    } finally {
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
        <Button
          variant="primary"
          iconRight="search"
         
          disabled={loading}
        >
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
