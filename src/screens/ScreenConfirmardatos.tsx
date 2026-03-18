import React from "react";
import { useTranslation } from "react-i18next";
import { Button, ConfirmBlock, Alert, Icon } from "@/components/ui";
import type { PartialGuestData } from "@/types";

interface Props {
  guest: PartialGuestData;
  onConfirm: () => void;
  onEdit: () => void;
}

export const ScreenConfirmarDatos: React.FC<Props> = ({
  guest,
  onConfirm,
  onEdit,
}) => {
  const { t } = useTranslation();

  const fullName = [guest.nombre, guest.apellido, guest.apellido2]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="sec-hdr">
        <h2>{t("review.confirm_title")}</h2>
        <p>{t("review.confirm_sub")}</p>
      </div>

      <div style={{ padding: "12px 24px 0" }}>
        <Alert variant="info">{t("review.confirm_alert")}</Alert>

        <ConfirmBlock
          title={t("forms.personal_title")}
          rows={[
            [t("forms.full_name"), fullName || null],
            [
              t("forms.gender"),
              guest.sexo ? t(`constants.sexos.${guest.sexo}`) : null,
            ],
            [t("forms.birthdate_clean"), guest.fechaNac ?? null],
            [
              t("forms.nationality"),
              guest.nacionalidad
                ? t(`constants.nacionalidades.${guest.nacionalidad}`)
                : null,
            ],
          ]}
        />

        {guest.tipoDoc && (
          <ConfirmBlock
            title={t("forms.doc_title")}
            rows={[
              [t("forms.doc_type"), t(`constants.documentos.${guest.tipoDoc}`)],
              [t("forms.doc_number"), guest.numDoc ?? null],
            ]}
          />
        )}

        {guest.email && (
          <ConfirmBlock
            title={t("forms.contact_title")}
            rows={[
              [t("forms.email"), guest.email ?? null],
              [t("forms.phone"), guest.telefono ?? null],
            ]}
          />
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="primary" iconRight="right" onClick={onConfirm}>
          {t("review.confirm_btn")}
        </Button>
        <Button variant="secondary" iconLeft="edit" onClick={onEdit}>
          {t("review.edit_btn")}
        </Button>
      </div>

      <div className="privacy" style={{ paddingBottom: 20 }}>
        <Icon name="lock" size={11} />
        {t("common.privacy_ssl")}
      </div>
    </>
  );
};
