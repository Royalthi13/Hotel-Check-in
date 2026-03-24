import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, ConfirmBlock, Icon } from "@/components/ui";
import { ReservationCard } from "@/components/ui";
import { HORAS_LLEGADA } from "@/constants";
import { validatePersonal, validateContacto } from "@/hooks/useFormValidation";
import type { CheckinState, PartialGuestData } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════
// FORM EXTRAS
// ═══════════════════════════════════════════════════════════════════════════
interface FormExtrasProps {
  horaLlegada: string;
  observaciones: string;
  onHoraChange: (v: string) => void;
  onObsChange: (v: string) => void;
  onNext: () => void;
}

export const ScreenFormExtras: React.FC<FormExtrasProps> = ({
  horaLlegada,
  observaciones,
  onHoraChange,
  onObsChange,
  onNext,
}) => {
  const { t } = useTranslation();
  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    onNext();
  };
  return (
    <>
      <div className="sec-hdr">
        <h2>{t("review.extras_title")}</h2>
        <p>{t("review.extras_sub")}</p>
      </div>
      <form onSubmit={handleSubmit}>
        <div className="fields" style={{ marginTop: 12 }}>
          <div className="divlabel">{t("review.arrival")}</div>
          <Field label={t("review.est_arrival")}>
            <select
              value={horaLlegada}
              onChange={(e) => onHoraChange(e.target.value)}
            >
              {HORAS_LLEGADA.map((h) => (
                <option key={h} value={h}>
                  {h.includes(":") ? h : t(`constants.horas.${h}`)}
                </option>
              ))}
            </select>
          </Field>

          <div className="divlabel">{t("review.requests")}</div>
          <Field label={t("review.obs_label")}>
            <textarea
              rows={4}
              value={observaciones}
              onChange={(e) => onObsChange(e.target.value)}
              placeholder={t("review.obs_placeholder")}
            />
          </Field>

          <Alert variant="info" style={{ marginTop: 8 }}>
            {t("review.requests_info")}
          </Alert>
        </div>
      </form>
      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={onNext}>
          {t("review.btn_review")}
        </Button>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// Helper: valida un huésped completo con las mismas funciones que los formularios.
//
// ANTES: !!g.numDoc?.trim()  →  solo comprueba que no esté vacío.
// AHORA: validatePersonal()  →  comprueba formato real (DNI, NIE, etc.).
//
// Si el usuario pone "PEPE" como DNI, el campo no está vacío pero
// validatePersonal devuelve un error → isGuestValid devuelve false
// → isDataComplete es false → botón final deshabilitado.
// ═══════════════════════════════════════════════════════════════════════════
function isGuestValid(
  g: PartialGuestData,
  idx: number,
  t: ReturnType<typeof useTranslation>["t"],
): boolean {
  const personalErrors = validatePersonal({ ...g, isTitular: idx === 0 }, t);
  if (Object.keys(personalErrors).length > 0) return false;

  if (idx === 0) {
    const contactErrors = validateContacto(g, t);
    if (Object.keys(contactErrors).length > 0) return false;
  }

  if (g.esMenor && (g.relacionesConAdultos ?? []).length === 0) return false;

  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// REVISION
// ═══════════════════════════════════════════════════════════════════════════
interface RevisionProps {
  state: CheckinState;
  isSubmitting: boolean;
  onEditStep: (step: string, guestIndex?: number) => void;
  onSubmit: () => Promise<void>;
  onRgpdChange: (v: boolean) => void;
}

export const ScreenRevision: React.FC<RevisionProps> = ({
  state,
  isSubmitting,
  onEditStep,
  onSubmit,
  onRgpdChange,
}) => {
  const { t } = useTranslation();
  const { reserva, guests, horaLlegada, observaciones, rgpdAcepted } = state;
  const main = guests[0] ?? {};

  // Validación real: mismas funciones que los formularios.
  // En teoría si llegaste aquí es porque el botón Resumen no estaba bloqueado,
  // pero lo comprobamos igualmente como segunda línea de defensa.
  const isDataComplete = guests.every((g, idx) => isGuestValid(g, idx, t));

  const fullName = (g: typeof main) =>
    [g.nombre, g.apellido, g.apellido2].filter(Boolean).join(" ");

  return (
    <>
      <div className="sec-hdr">
        <h2>{t("review.review_data_title")}</h2>
        <p>{t("review.review_data_sub")}</p>
      </div>

      <div style={{ padding: "8px 24px 0" }}>
        {reserva && (
          <div style={{ marginBottom: 12 }}>
            <ReservationCard reserva={reserva} />
          </div>
        )}

        {guests.map((g, idx) => (
          <React.Fragment key={idx}>
            <ConfirmBlock
              title={
                idx === 0
                  ? t("review.main_guest_personal")
                  : t("review.companion_personal", { count: idx + 1 })
              }
              onEdit={() => onEditStep("form_personal", idx)}
              rows={((): Array<[string, string | undefined | null]> => [
                [t("forms.full_name"), fullName(g) || null],
                [
                  t("forms.gender"),
                  g.sexo ? t(`constants.sexos.${g.sexo}`) : null,
                ],
                [t("forms.birthdate_clean"), g.fechaNac ?? null],
                [
                  t("forms.nationality"),
                  g.nacionalidad
                    ? t(`constants.nacionalidades.${g.nacionalidad}`)
                    : null,
                ],
                ...(g.esMenor && (g.relacionesConAdultos ?? []).length > 0
                  ? (g.relacionesConAdultos ?? []).map((r) => {
                      const label = t("review.relation_adult", { count: r.adultoIndex + 1 });
                      const value = (r.parentesco ?? "").trim()
                        ? t(`constants.parentescos.${r.parentesco}`)
                        : "—";
                      const row: [string, string] = [label, value];
                      return row;
                    })
                  : []),
              ])()}
            />
            <ConfirmBlock
              title={
                idx === 0
                  ? t("review.main_guest_doc")
                  : t("review.companion_doc", { count: idx + 1 })
              }
              onEdit={() => onEditStep("form_personal", idx)}
              rows={[
                [
                  t("forms.doc_type"),
                  g.tipoDoc ? t(`constants.documentos.${g.tipoDoc}`) : null,
                ],
                [t("forms.doc_number"), g.numDoc ?? null],
                ...(g.vat ? [[t("forms.vat"), g.vat] as [string, string]] : []),
                [
                  t("forms.photo"),
                  g.docUploaded ? t("review.photo_attached") : "—",
                ],
              ]}
            />
          </React.Fragment>
        ))}

        <ConfirmBlock
          title={t("review.contact_address")}
          onEdit={() => onEditStep("form_contacto", 0)}
          rows={[
            [t("forms.email"), main.email ?? null],
            [t("forms.phone"), main.telefono ?? null],
            [
              t("forms.address"),
              [main.direccion, main.ciudad, main.provincia, main.cp, main.pais]
                .filter(Boolean)
                .join(", ") || null,
            ],
          ]}
        />

        {(horaLlegada || observaciones) && (
          <ConfirmBlock
            title={t("review.extras_title")}
            onEdit={() => onEditStep("form_extras")}
            rows={[
              [
                t("review.arrival"),
                horaLlegada && !horaLlegada.includes(":")
                  ? t(`constants.horas.${horaLlegada}`)
                  : horaLlegada || null,
              ],
              [t("review.notes"), observaciones || null],
            ]}
          />
        )}
      </div>

      <div className="chk-area">
        <input
          type="checkbox"
          id="chk-accept"
          checked={rgpdAcepted ?? false}
          onChange={(e) => onRgpdChange(e.target.checked)}
        />
        <label htmlFor="chk-accept">
          {t("review.rgpd_long_1")}
          <a href="#">{t("review.rgpd_long_2")}</a>
          {t("review.rgpd_long_3")}
          <a href="#">{t("review.rgpd_long_4")}</a>
          {t("review.rgpd_long_5")}
        </label>
      </div>

      <div className="spacer" />
      <div className="btn-row" style={{ flexDirection: "column", gap: 12 }}>
        <Button
          variant="primary"
          iconRight={isSubmitting ? undefined : "check"}
          onClick={onSubmit}
          disabled={!rgpdAcepted || !isDataComplete || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
              {t("review.btn_sending")}
            </>
          ) : (
            t("review.btn_complete_checkin")
          )}
        </Button>
        <div className="privacy">
          <Icon name="lock" size={11} /> {t("common.privacy_ssl")}
        </div>
      </div>
    </>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// ÉXITO
// ═══════════════════════════════════════════════════════════════════════════
interface ExitoProps {
  state: CheckinState;
  onAddHora?: () => void;
  isPartial?: boolean;
}

export const ScreenExito: React.FC<ExitoProps> = ({
  state,
  onAddHora,
  isPartial,
}) => {
  const { t } = useTranslation();
  const { reserva, guests, horaLlegada } = state;
  const main = guests[0] ?? {};
  const nombreCompleto = [main.nombre, main.apellido].filter(Boolean).join(" ");
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  if (isPartial) {
    return (
      <div className="success-wrap">
        <div className="success-ring" style={{ borderColor: "var(--primary)" }}>
          <Icon name="checkC" size={42} color="var(--primary)" />
        </div>
        <h1 className="success-title">
          {t("success.partial_title", { defaultValue: "¡Progreso guardado!" })}
        </h1>
        <p className="success-sub">
          {t("success.partial_sub", {
            defaultValue:
              "Los datos se han guardado correctamente. Comparta este enlace con el resto de acompañantes para que completen su registro de forma rápida y segura.",
          })}
        </p>
        <div style={{ marginTop: 24, width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <Button variant="primary" onClick={handleCopyLink} iconLeft={copied ? "check" : undefined}>
            {copied
              ? t("common.copied", { defaultValue: "¡Enlace copiado!" })
              : t("common.copy_link", { defaultValue: "Copiar enlace para compartir" })}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="success-wrap">
        <div className="success-ring">
          <Icon name="checkC" size={42} color="var(--ok)" />
        </div>
        <h1 className="success-title">
          {t("success.title_precheckin_1")}
          <br />
          {t("success.title_precheckin_2")}
        </h1>
        <p className="success-sub">{t("success.subtitle_precheckin")}</p>

        <div className="success-info-card">
          {reserva && (
            <>
              <div className="si-row">
                <span>{t("success.booking")}</span>
                <span>{reserva.confirmacion}</span>
              </div>
              <div className="si-row">
                <span>{t("success.room")}</span>
                <span>{reserva.habitacion}</span>
              </div>
              <div style={{ height: 1, background: "var(--border)" }} />
            </>
          )}
          {nombreCompleto && (
            <div className="si-row">
              <span>{t("success.main_guest")}</span>
              <span>{nombreCompleto}</span>
            </div>
          )}
          {state.numAdultos + state.numMenores > 1 && (
            <div className="si-row">
              <span>{t("success.total_guests")}</span>
              <span>{state.numAdultos + state.numMenores}</span>
            </div>
          )}
          {main.tipoDoc && (
            <div className="si-row">
              <span>{t("forms.doc_title")}</span>
              <span>{t(`constants.documentos.${main.tipoDoc}`)} · {main.numDoc}</span>
            </div>
          )}
          {horaLlegada && horaLlegada !== "No especificada" && (
            <div className="si-row">
              <span>{t("success.expected_arrival")}</span>
              <span>
                {horaLlegada.includes(":") ? horaLlegada : t(`constants.horas.${horaLlegada}`)}
              </span>
            </div>
          )}
        </div>

        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <Button variant="primary" style={{ background: "var(--secondary)" }} onClick={() => window.print()}>
            <Icon name="check" size={16} /> {t("success.btn_print")}
          </Button>
          {(!horaLlegada || horaLlegada === "No especificada") && onAddHora && (
            <Button variant="secondary" iconLeft="clock" onClick={onAddHora}>
              {t("success.btn_add_time")}
            </Button>
          )}
        </div>

        <div className="privacy" style={{ marginTop: 14 }}>
          <Icon name="info" size={11} /> {t("success.email_confirmation")}
        </div>
      </div>
    </>
  );
};