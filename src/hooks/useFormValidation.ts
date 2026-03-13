import { useState, useCallback } from 'react';
import type { PartialGuestData, FormErrors } from '../types';
import dayjs from 'dayjs'

type ValidatorFn<T> = (data: T) => FormErrors;

export function useFormValidation<T>(validator: ValidatorFn<T>) {
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = useCallback((data: T): boolean => {
    const errs = validator(data);
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [validator]);

  const clearError = useCallback((key: string) => {
    setErrors(e => {
      const next = { ...e };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, validate, clearError, clearAll };
}

// ─── Validadores por pantalla ─────────────────────────────────────────────

export function validatePersonal(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};
  if (!data.nombre?.trim())   e.nombre   = 'El nombre es obligatorio';
  if (!data.apellido?.trim()) e.apellido = 'El primer apellido es obligatorio';
  if (!data.sexo)             e.sexo     = 'Indique el sexo';
  
  // 🛡️ NUEVA VALIDACIÓN DE FECHA BLINDADA
  if (!data.fechaNac) {
    e.fechaNac = 'La fecha de nacimiento es obligatoria';
  } else {
    const parsedDate = dayjs(data.fechaNac);
    
    if (!parsedDate.isValid()) {
      e.fechaNac = 'La fecha introducida no es válida';
    } else if (parsedDate.isAfter(dayjs())) {
      e.fechaNac = 'La fecha de nacimiento no puede ser futura';
    } else if (parsedDate.year() < 1900) {
      e.fechaNac = 'Introduce un año válido (ej. 1980)';
    }
  }

  return e;
}

export function validateContacto(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};
  if (!data.email?.trim())    e.email    = 'El email es obligatorio';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = 'Email no válido';
  if (!data.telefono?.trim()) e.telefono = 'El teléfono es obligatorio';
  if (!data.pais)             e.pais     = 'El país es obligatorio';
  return e;
}

export function validateDocumento(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};
  if (!data.tipoDoc) e.tipoDoc = 'Seleccione el tipo de documento';
  if (!data.numDoc?.trim()) e.numDoc = 'El número de documento es obligatorio';
  return e;
}

export function validateNumPersonas(n: number): FormErrors {
  const e: FormErrors = {};
  if (!n || n < 1) e.numPersonas = 'Indique al menos 1 persona';
  if (n > 10)      e.numPersonas = 'Máximo 10 personas por reserva';
  return e;
}