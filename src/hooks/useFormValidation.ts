import { useState, useCallback } from 'react';
import type { PartialGuestData, FormErrors } from '@/types';
import dayjs from 'dayjs';

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcularEdad(fechaNac: string | undefined): number | null {
  if (!fechaNac) return null;
  const d = dayjs(fechaNac);
  if (!d.isValid()) return null;
  return dayjs().diff(d, "years");
}

// ─── Validación de documentos de identidad españoles ─────────────────────────

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Valida formato y letra de control de un DNI español (8 dígitos + letra) */
function validarDNI(num: string): boolean {
  const match = num.toUpperCase().match(/^(\d{8})([A-Z])$/);
  if (!match) return false;
  const [, digits, letra] = match;
  return LETRAS_DNI[parseInt(digits, 10) % 23] === letra;
}

/** Valida formato y letra de control de un NIE español (X/Y/Z + 7 dígitos + letra) */
function validarNIE(num: string): boolean {
  const upper = num.toUpperCase();
  const match = upper.match(/^([XYZ])(\d{7})([A-Z])$/);
  if (!match) return false;
  const [, prefix, digits, letra] = match;
  const prefixNum = { X: '0', Y: '1', Z: '2' }[prefix]!;
  return LETRAS_DNI[parseInt(prefixNum + digits, 10) % 23] === letra;
}

/** Valida formato de pasaporte español (3 letras + 6 dígitos) o genérico internacional */
function validarPasaporte(num: string): boolean {
  // Pasaporte español: AAA123456
  if (/^[A-Z]{3}\d{6}$/.test(num.toUpperCase())) return true;
  // Pasaporte genérico internacional: 6–9 alfanuméricos
  if (/^[A-Z0-9]{6,9}$/.test(num.toUpperCase())) return true;
  return false;
}

/** Valida NIF de empresa español (letra + 7 dígitos + letra/dígito) */
function validarCIF(num: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$/i.test(num);
}

/** Valida carnet de conducir español (1-2 letras opcionales + 8 dígitos + 1-2 letras) */
function validarCarnet(num: string): boolean {
  return /^[A-Z]{0,2}\d{8}[A-Z]{1,2}$/i.test(num);
}

/**
 * Valida el número de documento según el tipo seleccionado.
 * Devuelve un mensaje de error o null si es válido.
 */
export function validarNumeroDocumento(tipo: string, num: string): string | null {
  const n = num.trim().toUpperCase();
  if (!n) return 'El número de documento es obligatorio';

  switch (tipo) {
    case 'DNI':
    case 'NIF':
      if (!validarDNI(n)) {
        return 'DNI no válido. Formato: 8 dígitos + letra (ej: 12345678Z)';
      }
      break;

    case 'NIE':
      if (!validarNIE(n)) {
        return 'NIE no válido. Formato: X/Y/Z + 7 dígitos + letra (ej: X1234567Z)';
      }
      break;

    case 'Pasaporte':
      if (!validarPasaporte(n)) {
        return 'Pasaporte no válido. Formato: 3 letras + 6 dígitos (ej: AAA123456)';
      }
      break;

    case 'CIF':
      if (!validarCIF(n)) {
        return 'CIF no válido. Formato: letra + 7 dígitos + letra/dígito (ej: A1234567B)';
      }
      break;

    case 'Carnet de conducir':
      if (!validarCarnet(n)) {
        return 'Carnet no válido. Formato esperado: hasta 2 letras + 8 dígitos + letras';
      }
      break;

    case 'Otro':
      // Sin validación de formato para documentos extranjeros genéricos
      if (n.length < 4) return 'El número de documento parece demasiado corto';
      break;

    default:
      break;
  }

  return null; // válido
}

// ─── Validadores por pantalla ─────────────────────────────────────────────────

export function validatePersonal(data: PartialGuestData): FormErrors {
  const e: FormErrors = {};

  if (!data.nombre?.trim()) e.nombre = "El nombre es obligatorio";
  if (!data.apellido?.trim()) e.apellido = "El primer apellido es obligatorio";
  if (!data.sexo) e.sexo = "Indique el sexo";

  if (!data.fechaNac) {
    e.fechaNac = "La fecha de nacimiento es obligatoria";
  } else {
    const parsed = dayjs(data.fechaNac);
    if (!parsed.isValid())            e.fechaNac = 'La fecha introducida no es válida';
    else if (parsed.isAfter(dayjs())) e.fechaNac = 'La fecha de nacimiento no puede ser futura';
    else if (parsed.year() < 1900)    e.fechaNac = 'Introduce un año válido (ej: 1980)';
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

  if (!data.tipoDoc) {
    e.tipoDoc = 'Seleccione el tipo de documento';
    return e; // sin tipo no podemos validar el número
  }

  const errorNum = validarNumeroDocumento(data.tipoDoc, data.numDoc ?? '');
  if (errorNum) e.numDoc = errorNum;

  return e;
}

export function validateNumPersonas(n: number): FormErrors {
  const e: FormErrors = {};
  if (!n || n < 1) e.numPersonas = "Indique al menos 1 persona";
  if (n > 10) e.numPersonas = "Máximo 10 personas por reserva";
  return e;
}
