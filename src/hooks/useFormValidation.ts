import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { PartialGuestData, FormErrors } from "@/types";
import dayjs from "dayjs";

type ValidatorFn<T> = (data: T, t: TFunction) => FormErrors;

export function useFormValidation<T>(validator: ValidatorFn<T>) {
  const { t } = useTranslation();
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = useCallback(
    (data: T): boolean => {
      const errs = validator(data, t);
      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    [validator, t],
  );

  const clearError = useCallback((key: string) => {
    setErrors((e) => {
      const n = { ...e };
      delete n[key];
      return n;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll };
}

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

function validarDNI(num: string): boolean {
  const match = num.toUpperCase().match(/^(\d{8})([A-Z])$/);
  if (!match) return false;
  const [, digits, letra] = match;
  return LETRAS_DNI[parseInt(digits, 10) % 23] === letra;
}

export function validarNumeroDocumento(
  tipo: string,
  num: string,
  t: TFunction,
): string | null {
  const n = num.trim().toUpperCase();
  if (!n) return t("validation.required_doc_num");

  switch (tipo) {
    case "DNI":
    case "NIF":
      if (!validarDNI(n)) return t("validation.invalid_dni");
      break;
    case "NIE":
      if (n.length < 9) return t("validation.invalid_nie");
      break;
    case "Pasaporte":
      if (n.length < 6) return t("validation.invalid_passport");
      break;
    default:
      if (n.length < 4) return t("validation.doc_too_short");
      break;
  }
  return null;
}

export function validatePersonal(
  data: PartialGuestData & { isTitular?: boolean },
  t: TFunction,
): FormErrors {
  const e: FormErrors = {};

  if (!data.nombre?.trim()) e.nombre = t("validation.required_name");
  if (!data.apellido?.trim()) e.apellido = t("validation.required_surname");
  if (!data.sexo) e.sexo = t("validation.required_gender");

  if (!data.fechaNac) {
    e.fechaNac = t("validation.required_birthdate");
  } else {
    const parsed = dayjs(data.fechaNac);
    if (!parsed.isValid()) {
      e.fechaNac = t("validation.invalid_birthdate");
    } else if (parsed.isAfter(dayjs())) {
      e.fechaNac = t("validation.future_birthdate");
    } else {
      const edad = dayjs().diff(parsed, "years");
      if (data.isTitular && edad < 18) {
        e.fechaNac = t("forms.adult_must_be_18");
      }
    }
  }

  if (!data.tipoDoc) {
    e.tipoDoc = t("validation.required_doc_type");
  } else {
    const errorNum = validarNumeroDocumento(data.tipoDoc, data.numDoc ?? "", t);
    if (errorNum) e.numDoc = errorNum;

    // FIX BUG MEDIUM #6: usar clave i18n correcta (sin defaultValue hardcodeado en ES)
    // La clave "validation.required_doc_support" ahora existe en todos los locales
    if (data.tipoDoc === "DNI" || data.tipoDoc === "NIE") {
      if (!data.soporteDoc?.trim()) {
        e.soporteDoc = t("validation.required_doc_support");
      }
    }
  }

  return e;
}

export function validateContacto(
  data: PartialGuestData,
  t: TFunction,
): FormErrors {
  const e: FormErrors = {};
  if (!data.email?.trim()) {
    e.email = t("validation.required_email");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    e.email = t("validation.invalid_email");
  }
  if (!data.telefono?.trim()) e.telefono = t("validation.required_phone");
  if (!data.pais) e.pais = t("validation.required_country");
  return e;
}