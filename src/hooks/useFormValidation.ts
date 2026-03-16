import { useState, useCallback } from "react";
import type { PartialGuestData, FormErrors } from "../types";
import dayjs from "dayjs";

type ValidatorFn<T> = (data: T) => FormErrors;

export function useFormValidation<T>(validator: ValidatorFn<T>) {
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = useCallback(
    (data: T): boolean => {
      const errs = validator(data);
      setErrors(errs);
      return Object.keys(errs).length === 0;
    },
    [validator],
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula la edad en años a partir de fechaNac (string YYYY-MM-DD) */
function calcularEdad(fechaNac: string | undefined): number | null {
  if (!fechaNac) return null;
  const d = dayjs(fechaNac);
  if (!d.isValid()) return null;
  return dayjs().diff(d, "years");
}

// ─── Validadores ──────────────────────────────────────────────────────────────

export function validatePersonal(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};

  if (!data.nombre?.trim()) e.nombre = "El nombre es obligatorio";
  if (!data.apellido?.trim()) e.apellido = "El primer apellido es obligatorio";
  if (!data.sexo) e.sexo = "Indique el sexo";

  if (!data.fechaNac) {
    e.fechaNac = "La fecha de nacimiento es obligatoria";
  } else {
    const parsed = dayjs(data.fechaNac);
    if (!parsed.isValid()) e.fechaNac = "La fecha introducida no es válida";
    else if (parsed.isAfter(dayjs()))
      e.fechaNac = "La fecha de nacimiento no puede ser futura";
    else if (parsed.year() < 1900)
      e.fechaNac = "Introduce un año válido (ej. 1980)";
  }

  const edad = calcularEdad(data.fechaNac);
  const esMenor = edad !== null && edad < 18;

  if (esMenor) {
    if (!data.nombreMenor?.trim())
      e.nombreMenor = "Indique el nombre del responsable adulto";
    if (!data.relacionMenor)
      e.relacionMenor = "Indique el parentesco con el menor";
  }

  return e;
}

export function validateContacto(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};
  if (!data.email?.trim()) e.email = "El email es obligatorio";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    e.email = "Email no válido";
  if (!data.telefono?.trim()) e.telefono = "El teléfono es obligatorio";
  if (!data.pais) e.pais = "El país es obligatorio";
  return e;
}

export function validateDocumento(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};
  if (!data.tipoDoc) e.tipoDoc = "Seleccione el tipo de documento";
  if (!data.numDoc?.trim()) e.numDoc = "El número de documento es obligatorio";
  return e;
}

export function validateNumPersonas(n: number): FormErrors {
  const e: FormErrors = {};
  if (!n || n < 1) e.numPersonas = "Indique al menos 1 persona";
  if (n > 10) e.numPersonas = "Máximo 10 personas por reserva";
  return e;
}
