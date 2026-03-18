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
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const LETRAS_DNI = "TRWAGMYFPDXBNJZSQVHLCKE";

function validarDNI(num: string): boolean {
  const match = num.toUpperCase().match(/^(\d{8})([A-Z])$/);
  if (!match) return false;
  const [, digits, letra] = match;
  return LETRAS_DNI[parseInt(digits, 10) % 23] === letra;
}

function validarNIE(num: string): boolean {
  const upper = num.toUpperCase();
  const match = upper.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (!match) return false;
  const [, prefix, digits, letra] = match;
  const prefixNum = { X: "0", Y: "1", Z: "2" }[prefix]!;
  return LETRAS_DNI[parseInt(prefixNum + digits, 10) % 23] === letra;
}

function validarPasaporte(num: string): boolean {
  if (/^[A-Z]{3}\d{6}$/.test(num.toUpperCase())) return true;
  if (/^[A-Z0-9]{6,9}$/.test(num.toUpperCase())) return true;
  return false;
}

function validarCIF(num: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/i.test(num);
}

function validarCarnet(num: string): boolean {
  return /^[A-Z]{0,2}\d{8}[A-Z]{1,2}$/i.test(num);
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
      if (!validarNIE(n)) return t("validation.invalid_nie");
      break;
    case "Pasaporte":
      if (!validarPasaporte(n)) return t("validation.invalid_passport");
      break;
    case "CIF":
      if (!validarCIF(n)) return t("validation.invalid_cif");
      break;
    case "Carnet de conducir":
      if (!validarCarnet(n)) return t("validation.invalid_license");
      break;
    case "Otro":
      if (n.length < 4) return t("validation.doc_too_short");
      break;
    default:
      break;
  }
  return null;
}

// ─── Validadores por pantalla ─────────────────────────────────────────────────

export function validatePersonal(
  // Aceptamos un flag temporal para saber si es el titular
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
    if (!parsed.isValid()) e.fechaNac = t("validation.invalid_birthdate");
    else if (parsed.isAfter(dayjs()))
      e.fechaNac = t("validation.future_birthdate");
    else if (parsed.year() < 1900) e.fechaNac = t("validation.old_birthdate");
    else {
      const edad = dayjs().diff(parsed, "years");
      // Solo prohibimos si es el Titular y tiene menos de 18
      if (data.isTitular && edad < 18) {
        e.fechaNac = t(
          "validation.adult_must_be_18",
          "El titular debe ser mayor de edad",
        );
      }
    }
  }

  if (!data.tipoDoc) {
    e.tipoDoc = t("validation.required_doc_type");
  } else {
    const errorNum = validarNumeroDocumento(data.tipoDoc, data.numDoc ?? "", t);
    if (errorNum) e.numDoc = errorNum;
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

  const phoneRegex = /^\+?[\d]{7,15}$/;
  if (!data.telefono?.trim()) {
    e.telefono = t("validation.required_phone");
  } else if (!phoneRegex.test(data.telefono.replace(/\s/g, ""))) {
    e.telefono = t("validation.invalid_phone");
  }

  if (!data.pais) {
    e.pais = t("validation.required_country");
  }

  return e;
}
