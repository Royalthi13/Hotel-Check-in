import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Field, Button, Alert, ConfirmBlock, Icon } from "@/components/ui";
import { ReservationCard } from "@/components/ui";
import { getRelationships } from "@/api/catalogs.service";
import type { CheckinState, PartialGuestData, RelacionDB } from "@/types";
import { HORAS_LLEGADA } from "@/constants";
import { validatePersonal, validateContacto } from "@/hooks/useFormValidation";
import "@/App.css";

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

  return (
    <>
      <div className="sec-hdr">
        <h2>{t("review.extras_title")}</h2>
        <p>{t("review.extras_sub")}</p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
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
// VALIDACIÓN
// ═══════════════════════════════════════════════════════════════════════════
function isGuestValid(g: PartialGuestData, idx: number, t: any): boolean {
  const personalErrors = validatePersonal({ ...g, isTitular: idx === 0 }, t);
  if (Object.keys(personalErrors).length > 0) return false;

  if (!g.esMenor) {
    const contactErrors = validateContacto(g, t);
    if (Object.keys(contactErrors).length > 0) return false;
  }
  if (g.esMenor && (g.relacionesConAdultos ?? []).length === 0) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// REVISIÓN (Cero Errores)
// ═══════════════════════════════════════════════════════════════════════════
interface RevisionProps {
  state: CheckinState;
  isSubmitting: boolean;
  onEditStep: (step: string, guestIndex?: number) => void;
  onSubmit: () => Promise<void>;
}

export const ScreenRevision: React.FC<RevisionProps> = ({
  state,
  isSubmitting,
  onEditStep,
  onSubmit,
}) => {
  const { t, i18n } = useTranslation();
  const { reserva, guests, horaLlegada, observaciones } = state;
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [listaRelaciones, setListaRelaciones] = useState<RelacionDB[]>([]);

  useEffect(() => {
    getRelationships().then(setListaRelaciones).catch(console.error);
  }, []);

  const isDataComplete = guests.every((g, idx) => isGuestValid(g, idx, t));

  // Traductor seguro para países (Evita el constants.nacionalidades.ESP)
  const traducirPais = useCallback(
    (codigo?: string) => {
      if (!codigo) return "—";
      const iso2 = codigo.substring(0, 2).toUpperCase();
      const key = `constants.paises.${iso2}`;
      const translation = t(key);

      if (translation && !translation.includes("constants.paises"))
        return translation;

      try {
        const lang = i18n.language ? i18n.language.split("-")[0] : "es";
        const displayNames = new Intl.DisplayNames([lang], { type: "region" });
        return displayNames.of(codigo.toUpperCase()) || codigo;
      } catch {
        return codigo;
      }
    },
    [t, i18n.language],
  );

  const fullName = (g: PartialGuestData) =>
    [g.nombre, g.apellido, g.apellido2].filter(Boolean).join(" ") || "—";

  return (
    <>
      <div className="sec-hdr">
        <h2>{t("review.review_data_title")}</h2>
        <p>{t("review.review_data_sub")}</p>
      </div>

      <div style={{ padding: "8px var(--px) 0" }}>
        {reserva && (
          <div style={{ marginBottom: 12 }}>
            <ReservationCard reserva={reserva} />
          </div>
        )}

        <div className="confirm-grid">
          {guests.map((g, idx) => {
            const menoresAcargo = !g.esMenor
              ? guests.filter(
                  (m) =>
                    m.esMenor &&
                    m.relacionesConAdultos?.some((r) => r.adultoIndex === idx),
                )
              : [];

            return (
              <React.Fragment key={idx}>
                {/* BLOQUE DATOS PERSONALES */}
                <ConfirmBlock
                  title={
                    idx === 0
                      ? t("review.main_guest_personal")
                      : t("review.companion_personal", { count: idx + 1 })
                  }
                  onEdit={() => onEditStep("form_personal", idx)}
                  rows={((): Array<[string, string | null]> => {
                    const rows: Array<[string, string | null]> = [
                      [t("forms.full_name"), fullName(g)],
                      [
                        t("forms.gender"),
                        g.sexo ? t(`constants.sexos.${g.sexo}`) : null,
                      ],
                      [t("forms.birthdate_clean"), g.fechaNac || null],
                      [t("forms.nationality"), traducirPais(g.pais)],
                    ];

                    // Si es menor: mostrar de quién depende
                    if (
                      g.esMenor &&
                      (g.relacionesConAdultos ?? []).length > 0
                    ) {
                      g.relacionesConAdultos?.forEach((r) => {
                        const adult = guests[r.adultoIndex];
                        const nameA = adult
                          ? [adult.nombre, adult.apellido]
                              .filter(Boolean)
                              .join(" ")
                          : `Adulto ${r.adultoIndex + 1}`;
                        const relDb = listaRelaciones.find(
                          (db) => db.codrelation === r.parentesco,
                        );
                        const inverseKey =
                          relDb?.linked_relation || r.parentesco;
                        const value = t(`parentescos.${inverseKey}`, {
                          defaultValue: relDb?.name || inverseKey,
                        });
                        rows.push([
                          t("review.responsible_for", { name: nameA }),
                          value,
                        ]);
                      });
                    }

                    // Si es adulto: mostrar menores a su cargo
                    if (!g.esMenor && menoresAcargo.length > 0) {
                      menoresAcargo.forEach((m) => {
                        const rel = m.relacionesConAdultos?.find(
                          (r) => r.adultoIndex === idx,
                        );
                        const nameM = [m.nombre, m.apellido]
                          .filter(Boolean)
                          .join(" ");
                        const value = t(`parentescos.${rel?.parentesco}`, {
                          defaultValue: rel?.parentesco,
                        });
                        rows.push([
                          t("review.responsible_for", { name: nameM }),
                          value,
                        ]);
                      });
                    }
                    return rows;
                  })()}
                />

                {/* BLOQUE DOCUMENTACIÓN (TRADUCIDO) */}
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
                      g.tipoDoc
                        ? t(`constants.documentos.${g.tipoDoc}`, {
                            defaultValue: g.tipoDoc,
                          })
                        : "—",
                    ],
                    [t("forms.doc_number"), g.numDoc || "—"],
                    ...(g.soporteDoc
                      ? [
                          [t("forms.doc_support"), g.soporteDoc] as [
                            string,
                            string,
                          ],
                        ]
                      : []),
                  ]}
                />
              </React.Fragment>
            );
          })}
        </div>

        {/* BLOQUE CONTACTO (SÓLO TITULAR) */}
        <ConfirmBlock
          title={t("review.contact_address")}
          onEdit={() => onEditStep("form_contacto", 0)}
          rows={[
            [t("forms.email"), guests[0]?.email || "—"],
            [t("forms.phone"), guests[0]?.telefono || "—"],
            [
              t("forms.address"),
              [
                guests[0]?.direccion,
                guests[0]?.ciudad,
                traducirPais(guests[0]?.pais),
              ]
                .filter(Boolean)
                .join(", ") || "—",
            ],
          ]}
        />

        {/* BLOQUE EXTRAS */}
        {(horaLlegada || observaciones) && (
          <ConfirmBlock
            title={t("review.extras_title")}
            onEdit={() => onEditStep("form_extras")}
            rows={[
              [
                t("review.arrival"),
                horaLlegada && !horaLlegada.includes(":")
                  ? t(`constants.horas.${horaLlegada}`)
                  : horaLlegada || "—",
              ],
              [t("review.notes"), observaciones || "—"],
            ]}
          />
        )}
      </div>

      <div className="chk-area">
        <input
          type="checkbox"
          id="chk-accept"
          checked={isConfirmed}
          onChange={(e) => setIsConfirmed(e.target.checked)}
        />
        <label htmlFor="chk-accept" style={{ cursor: "pointer" }}>
          {t("review.confirm_data_only")}
        </label>
      </div>

      <div className="spacer" />
      <div className="btn-row" style={{ flexDirection: "column", gap: 12 }}>
        <Button
          variant="primary"
          iconRight={isSubmitting ? undefined : "check"}
          onClick={onSubmit}
          disabled={!isConfirmed || !isDataComplete || isSubmitting}
        >
          {isSubmitting ? (
            <>
              <div
                className="spinner"
                style={{ width: 18, height: 18, borderWidth: 2 }}
              />{" "}
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
export const ScreenExito: React.FC<{
  state: CheckinState;
  onAddHora?: () => void;
  isPartial?: boolean;
}> = ({ state, onAddHora, isPartial }) => {
  const { t } = useTranslation();
  const { reserva, guests, horaLlegada } = state;
  const main = guests[0] || {};
  const nombreCompleto = [main.nombre, main.apellido].filter(Boolean).join(" ");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
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
        <h1 className="success-title">{t("success.partial_title")}</h1>
        <p className="success-sub">{t("success.partial_sub")}</p>
        <Button
          variant="primary"
          onClick={handleCopy}
          iconLeft={copied ? "check" : undefined}
        >
          {copied ? t("common.copied") : t("common.copy_link")}
        </Button>
      </div>
    );
  }

  return (
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
            <div
              style={{
                height: 1,
                background: "var(--border)",
                margin: "8px 0",
              }}
            />
          </>
        )}
        <div className="si-row">
          <span>{t("success.main_guest")}</span>
          <span>{nombreCompleto}</span>
        </div>
        {main.tipoDoc && (
          <div className="si-row">
            <span>{t("forms.doc_title")}</span>
            <span>
              {t(`constants.documentos.${main.tipoDoc}`, {
                defaultValue: main.tipoDoc,
              })}{" "}
              · {main.numDoc}
            </span>
          </div>
        )}
        {horaLlegada && horaLlegada !== "No especificada" && (
          <div className="si-row">
            <span>{t("success.expected_arrival")}</span>
            <span>
              {horaLlegada.includes(":")
                ? horaLlegada
                : t(`constants.horas.${horaLlegada}`)}
            </span>
          </div>
        )}
      </div>

      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Button
          variant="primary"
          style={{ background: "var(--secondary)" }}
          onClick={() => window.print()}
        >
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
  );
};
