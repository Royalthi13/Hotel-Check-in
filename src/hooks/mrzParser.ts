// src/hooks/mrzParser.ts

// ── Tabla de valores MRZ (ISO/IEC 7501) ──────────────────────────────────────
const CHAR_VALUE: Record<string, number> = { '<': 0 };
for (let i = 0; i < 26; i++) CHAR_VALUE[String.fromCharCode(65 + i)] = i + 10;
for (let i = 0; i < 10; i++) CHAR_VALUE[String(i)] = i;

const WEIGHTS = [7, 3, 1] as const;

export function mrzCheckDigit(field: string): number {
  return field
    .split('')
    .reduce((sum, ch, i) => sum + (CHAR_VALUE[ch] ?? 0) * WEIGHTS[i % 3], 0) % 10;
}

// ── Tipos de posición en MRZ ──────────────────────────────────────────────────
// Cada posición acepta un subconjunto de caracteres
type PosType = 'A' | 'N' | 'AN' | 'F' | '<';
// A = solo letras, N = solo números, AN = alfanumérico, F = fill '<', '<' = literal

/**
 * Esquemas de posiciones para TD1 (DNI - 3×30) y TD3 (Pasaporte - 2×44).
 * Fuente: ICAO Doc 9303 Part 5 (TD1) y Part 4 (TD3).
 */
const TD1_SCHEMA: PosType[][] = [
  // Línea 1: 30 caracteres
  // 0-1: tipo doc, 2-4: país emisor, 5-13: nº doc, 14: dígito ctrl, 15-29: opcional
  ['A','A','A','A','A','A','A','A','A','A','AN','AN','AN','AN','N','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN'],
  // Línea 2: 30 caracteres
  // 0-5: nac, 6: ctrl, 7: sexo, 8-13: exp, 14: ctrl, 15-27: nac+opt, 28-29: ctrl global
  ['N','N','N','N','N','N','N','A','N','N','N','N','N','N','N','A','A','A','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','N','N'],
  // Línea 3: 30 caracteres — todo el nombre
  ['AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN','AN'],
];

/**
 * Corrige un carácter según el tipo de posición esperado.
 * Errores OCR más comunes en fuente OCR-B:
 *   0 ↔ O  (casi idénticos visualmente)
 *   1 ↔ I ↔ L  
 *   5 ↔ S
 *   8 ↔ B
 *   2 ↔ Z
 */
function fixCharByType(ch: string, type: PosType): string {
  if (type === 'N') {
    // Posición numérica: convertir letras confundibles a número
    return ch
      .replace(/O/g, '0')
      .replace(/I/g, '1')
      .replace(/L/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8')
      .replace(/Z/g, '2')
      .replace(/G/g, '6')
      .replace(/[^0-9]/g, '0'); // cualquier otra letra → '0'
  }
  if (type === 'A') {
    // Posición alfabética: convertir números confundibles a letra
    return ch
      .replace(/0/g, 'O')
      .replace(/1/g, 'I')
      .replace(/5/g, 'S')
      .replace(/8/g, 'B')
      .replace(/[^A-Z<]/g, '<');
  }
  // AN: alfanumérico — solo limpiar caracteres inválidos
  return ch.replace(/[^A-Z0-9<]/g, '<');
}

/**
 * Normaliza y corrige una línea MRZ usando el esquema de posiciones TD1 o TD3.
 * @param raw     Texto crudo de Tesseract
 * @param schema  Array de tipos por posición
 * @param length  Longitud esperada (30 para TD1, 44 para TD3)
 */
function normalizeMrzLine(raw: string, schema: PosType[], length: number): string {
  // 1. Limpiar: mayúsculas, espacios→'<', solo chars válidos
  const cleaned = raw
    .toUpperCase()
    .replace(/\s+/g, '<')
    .replace(/[^A-Z0-9<]/g, '<')
    .trim();

  // 2. Pad o truncar a longitud exacta
  const padded = cleaned.padEnd(length, '<').slice(0, length);

  // 3. Corregir carácter a carácter según esquema de posiciones
  return padded
    .split('')
    .map((ch, i) => fixCharByType(ch, schema[i] ?? 'AN'))
    .join('');
}

// ── Tipos exportados ──────────────────────────────────────────────────────────

export interface MrzResult {
  tipoDoc:      string;
  numDoc:       string;
  nombre:       string;
  apellido:     string;
  apellido2:    string;
  fechaNac:     string;
  sexo:         string;
  nacionalidad: string;
  paisEmision:  string;
  valid:        boolean;
  confidence:   number;
  errors:       string[];
}

// ── Helpers de parsing ────────────────────────────────────────────────────────

function parseMrzName(field: string): { nombre: string; apellido: string; apellido2: string } {
  const clean  = field.replace(/<+$/, '');
  const sepIdx = clean.indexOf('<<');
  if (sepIdx === -1) {
    return { apellido: clean.replace(/</g, ' ').trim(), apellido2: '', nombre: '' };
  }
  const surnameParts = clean.slice(0, sepIdx).split('<').filter(Boolean);
  const givenParts   = clean.slice(sepIdx + 2).split('<').filter(Boolean);
  return {
    apellido:  surnameParts[0] ?? '',
    apellido2: surnameParts[1] ?? '',
    nombre:    givenParts.join(' '),
  };
}

function parseMrzDate(yymmdd: string): string {
  if (!yymmdd || yymmdd.replace(/[<0]/g, '').length < 4) return '';
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (isNaN(yy)) return '';
  const currentYY = new Date().getFullYear() % 100;
  const year      = yy > currentYY + 10 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

function parseSex(ch: string): string {
  if (ch === 'M') return 'Hombre';
  if (ch === 'F') return 'Mujer';
  return 'No indicar';
}

const NATIONALITY_MAP: Record<string, string> = {
  ESP: 'Española', DEU: 'Alemana', FRA: 'Francesa', ITA: 'Italiana',
  PRT: 'Portuguesa', GBR: 'Inglesa', USA: 'Estadounidense',
  ARG: 'Argentina', MEX: 'Mexicana', COL: 'Otra', BEL: 'Otra',
  CHE: 'Otra', NLD: 'Otra', SWE: 'Otra', NOR: 'Otra',
  DNK: 'Otra', AUT: 'Otra', POL: 'Otra', FIN: 'Otra', IRL: 'Otra',
};

// ── Parsers TD1 y TD3 ─────────────────────────────────────────────────────────

function parseTD1(l1raw: string, l2raw: string, l3raw: string): MrzResult {
  // Normalizar cada línea con su esquema de posiciones
  const l1 = normalizeMrzLine(l1raw, TD1_SCHEMA[0], 30);
  const l2 = normalizeMrzLine(l2raw, TD1_SCHEMA[1], 30);
  const l3 = normalizeMrzLine(l3raw, TD1_SCHEMA[2], 30);

  const errors: string[] = [];
  let ok = 0;

  // Línea 1
  const issuerCode  = l1.slice(2, 5).replace(/<+$/, '');
  const docNumber   = l1.slice(5, 14).replace(/<+$/, '');
  const docNumCheck = parseInt(l1[14] ?? '0', 10);
  if (mrzCheckDigit(l1.slice(5, 14)) === docNumCheck) ok++;
  else errors.push('Dígito de control incorrecto en número de documento');

  // Línea 2
  const dobRaw          = l2.slice(0, 6);
  const dobCheck        = parseInt(l2[6]  ?? '0', 10);
  const sexChar         = l2[7] ?? '<';
  const expiryRaw       = l2.slice(8, 14);
  const expiryCheck     = parseInt(l2[14] ?? '0', 10);
  const nationalityCode = l2.slice(15, 18).replace(/<+$/, '');

  if (mrzCheckDigit(dobRaw)    === dobCheck)    ok++;
  else errors.push('Dígito de control incorrecto en fecha de nacimiento');
  if (mrzCheckDigit(expiryRaw) === expiryCheck) ok++;
  else errors.push('Dígito de control incorrecto en fecha de expiración');

  // Determinar tipoDoc (l1[0]='I' para DNI español, l1[1]='D' en algunos)
  const docChar0 = l1[0] ?? '';
  let tipoDoc = 'Otro';
  if (docChar0 === 'I' || docChar0 === 'D') {
    if (issuerCode === 'ESP') {
      tipoDoc = ['X', 'Y', 'Z'].includes(docNumber[0] ?? '') ? 'NIE' : 'DNI';
    } else {
      tipoDoc = 'Otro';
    }
  }

  const { nombre, apellido, apellido2 } = parseMrzName(l3);

  return {
    tipoDoc, numDoc: docNumber, nombre, apellido, apellido2,
    fechaNac:     parseMrzDate(dobRaw),
    sexo:         parseSex(sexChar),
    nacionalidad: NATIONALITY_MAP[nationalityCode] ?? 'Otra',
    paisEmision:  issuerCode,
    valid:        errors.length === 0,
    confidence:   Math.round((ok / 3) * 100),
    errors,
  };
}

function parseTD3(l1raw: string, l2raw: string): MrzResult {
  // TD3 no tiene schema por posición en este parser (más simple)
  const l1 = l1raw.toUpperCase().replace(/\s/g,'<').replace(/[^A-Z0-9<]/g,'<').padEnd(44,'<').slice(0,44);
  const l2 = l2raw.toUpperCase().replace(/\s/g,'<').replace(/[^A-Z0-9<]/g,'<').padEnd(44,'<').slice(0,44);

  const errors: string[] = [];
  let ok = 0;

  const issuerCode      = l1.slice(2, 5).replace(/<+$/, '');
  const nameField       = l1.slice(5, 44);
  const docNumber       = l2.slice(0, 9).replace(/<+$/, '');
  const docNumCheck     = parseInt(l2[9]  ?? '0', 10);
  const nationalityCode = l2.slice(10, 13).replace(/<+$/, '');
  const dobRaw          = l2.slice(13, 19);
  const dobCheck        = parseInt(l2[19] ?? '0', 10);
  const sexChar         = l2[20] ?? '<';
  const expiryRaw       = l2.slice(21, 27);
  const expiryCheck     = parseInt(l2[27] ?? '0', 10);

  if (mrzCheckDigit(l2.slice(0, 9)) === docNumCheck) ok++;
  else errors.push('Dígito de control incorrecto en número de documento');
  if (mrzCheckDigit(dobRaw) === dobCheck) ok++;
  else errors.push('Dígito de control incorrecto en fecha de nacimiento');
  if (mrzCheckDigit(expiryRaw) === expiryCheck) ok++;
  else errors.push('Dígito de control incorrecto en fecha de expiración');

  const { nombre, apellido, apellido2 } = parseMrzName(nameField);

  return {
    tipoDoc: 'Pasaporte', numDoc: docNumber, nombre, apellido, apellido2,
    fechaNac:     parseMrzDate(dobRaw),
    sexo:         parseSex(sexChar),
    nacionalidad: NATIONALITY_MAP[nationalityCode] ?? 'Otra',
    paisEmision:  issuerCode,
    valid:        errors.length === 0,
    confidence:   Math.round((ok / 3) * 100),
    errors,
  };
}

// ── Función principal ─────────────────────────────────────────────────────────

export function parseMrzLines(rawLines: string[]): MrzResult {
  const EMPTY: MrzResult = {
    tipoDoc: '', numDoc: '', nombre: '', apellido: '', apellido2: '',
    fechaNac: '', sexo: '', nacionalidad: '', paisEmision: '',
    valid: false, confidence: 0,
    errors: ['No se detectaron líneas MRZ válidas en la imagen'],
  };

  // Limpieza inicial sin corrección por posición (eso lo hace cada parser)
  const lines = rawLines
    .map(l => l.toUpperCase().replace(/\s+/g, '<').replace(/[^A-Z0-9<]/g, '<').trim())
    .filter(l => l.length >= 25); // permisivo — cada parser normaliza a 30/44

  if (lines.length === 0) return EMPTY;

  // ── Intentar TD3 (pasaporte) ──────────────────────────────────────────────
  // Primera línea empieza por P o V y tiene ≥40 chars
  const td3L1 = lines.find(l => l.length >= 40 && (l[0] === 'P' || l[0] === 'V'));
  if (td3L1) {
    const td3L2 = lines.find(l => l !== td3L1 && l.length >= 40 && /^\d/.test(l));
    if (td3L2) return parseTD3(td3L1, td3L2);
  }

  // ── Intentar TD1 (DNI/NIE español y otros) ───────────────────────────────
  // Primera línea empieza por I o D
  const td1L1 = lines.find(l => l[0] === 'I' || l[0] === 'D');
  if (td1L1) {
    const rest = lines.filter(l => l !== td1L1);
    // Línea 2: empieza por dígito (fecha nacimiento)
    const td1L2 = rest.find(l => /^\d/.test(l)) ?? rest[0] ?? '';
    // Línea 3: contiene '<<' (separador apellido/nombre)
    const td1L3 = rest.find(l => l !== td1L2 && l.includes('<<'))
               ?? rest.find(l => l !== td1L2)
               ?? '';
    return parseTD1(td1L1, td1L2, td1L3);
  }

  // ── Fallbacks ─────────────────────────────────────────────────────────────
  if (lines.length >= 3) return parseTD1(lines[0], lines[1], lines[2]);
  if (lines.length === 2) {
    if (lines[0][0] === 'P' || lines[0][0] === 'V') return parseTD3(lines[0], lines[1]);
    return parseTD1(lines[0], lines[1], '');
  }

  return EMPTY;
}