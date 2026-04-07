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

function validarNIE(num: string): boolean {
  const upper = num.toUpperCase();
  if (!/^[XYZ]\d{7}[A-Z]$/.test(upper)) return false;
  const map: Record<string, string> = { X: "0", Y: "1", Z: "2" };
  const digits = map[upper[0]] + upper.slice(1, 8);
  return LETRAS_DNI[parseInt(digits, 10) % 23] === upper[8];
}

function validarCIF(num: string): boolean {
  const upper = num.toUpperCase();
  // letra organizativa + 7 dígitos + dígito/letra de control
  return /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[A-J0-9]$/.test(upper);
}
function validarDocSupport(docsupport: string): boolean {
  if (!docsupport) return false;

  const value = docsupport.trim().toUpperCase();

  if (value.length < 8 || value.length > 12) return false;
  if (!/^[A-Z0-9]+$/.test(value)) return false;
  if (!/[A-Z]/.test(value) || !/\d/.test(value)) return false;

  return true;
}
function validarPasaporte(num: string): boolean {
  const upper = num.toUpperCase();
  // Pasaporte español: 3 letras + 6 dígitos. Internacionales: 6-12 alfanuméricos
  return upper.length >= 6 && /^[A-Z0-9]{6,15}$/.test(upper);
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
      if (!validarDNI(n)) return t("validation.invalid_dni");
      break;
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

    if (data.tipoDoc === "DNI" || data.tipoDoc === "NIE") {
      const soporte = data.soporteDoc?.trim();

      if (!soporte) {
        e.soporteDoc = t("validation.required_doc_support");
      } else if (!validarDocSupport(soporte)) {
        e.soporteDoc = t("validation.invalid_doc_support");
      }
    }
  }

  return e;
}

export function validateContacto(
  data: PartialGuestData,
  t: TFunction,
  locked?: { email?: boolean; telefono?: boolean },
): FormErrors {
  const e: FormErrors = {};

  const tieneEmail = !!data.email?.trim();
  const tieneTelefono = !!data.telefono?.trim();

  // Si ninguno viene bloqueado de reserva → al menos uno es obligatorio
  if (!locked?.email && !locked?.telefono) {
    if (!tieneEmail && !tieneTelefono) {
      e.email = t("validation.required_email_or_phone");
      e.telefono = t("validation.required_email_or_phone");
    } else {
      // Valida formato solo si tiene valor
      if (tieneEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email!)) {
        e.email = t("validation.invalid_email");
      }
    }
  } else {
    // Uno viene bloqueado → el otro es obligatorio
    if (!locked?.telefono && !tieneEmail) {
      e.email = t("validation.required_email");
    } else if (tieneEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email!)) {
      e.email = t("validation.invalid_email");
    }

    if (!locked?.email && !tieneTelefono) {
      e.telefono = t("validation.required_phone");
    }
  }

  if (!data.pais) e.pais = t("validation.required_country");
  return e;
}
