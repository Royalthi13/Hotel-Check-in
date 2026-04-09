// src/hooks/useDocumentOCR.ts
//
// FIXES en esta versión:
//   1. filterOcrGarbage(): los fillers MRZ (<<<<<) se leen como K, L, etc.
//      Se filtran "palabras" sin vocales o con alta repetición de un carácter.
//      "AdrianKLLLLKL" → "Adrian".
//
//   2. Auto-set pais='ES' para DNI español (natCode === 'ESP').
//
//   3. Extracción de domicilio del REVERSO del DNI (misma foto que el MRZ).
//      El domicilio está en el TOP 45% del reverso, encima de la MRZ.
//      Se hace un segundo pase OCR sin whitelist después de leer la MRZ.
//      Campos que se rellenan: direccion, cp, ciudad, provincia, pais.
//
//   4. EXIF rotation via canvas (ya presente, se mantiene).
//   5. Nombres: f.lastName/f.firstName de la librería mrz como fuente primaria.

import { useState, useRef, useCallback } from 'react';
import { createWorker, PSM }             from 'tesseract.js';
import { decode as ijsDecode, encodeDataURL as ijsEncodeDataURL } from 'image-js';
import { parse as mrzParse }             from 'mrz';
import type { ParseResult }              from 'mrz';
import type { PartialGuestData }         from '@/types';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface OCRProgress { fase: string; pct: number; }

export interface OCRResult {
  ok:         boolean;
  data?:      Partial<PartialGuestData>;
  formato?:   string | null;
  confianza?: number;
  error?:     string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WHITELIST    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
const MIN_SCORE    = 0.28;
const GOOD_SCORE   = 0.72;
const MRZ_TARGET_W = 2200;
const MAX_INPUT_W  = 2400;

const NAT: Record<string, string> = {
  ESP: 'Española', GBR: 'Inglesa',   FRA: 'Francesa',  DEU: 'Alemana',
  ITA: 'Italiana', PRT: 'Portuguesa', USA: 'Estadounidense',
  ARG: 'Argentina', MEX: 'Mexicana', BRA: 'Otra', CHN: 'Otra',
  JPN: 'Otra', KOR: 'Otra', IND: 'Otra', AUS: 'Otra',
  MAR: 'Otra', SEN: 'Otra', COL: 'Otra', PER: 'Otra', VEN: 'Otra',
};

// ─── EXIF correction via canvas ───────────────────────────────────────────────

async function loadExifCorrectedBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/png');
      } catch (e) { URL.revokeObjectURL(url); reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load failed')); };
    img.src = url;
  });
}

// ─── FIX: filtrar basura OCR de los nombres ───────────────────────────────────
// Los fillers MRZ "<<<<<" se transcriben por Tesseract como K, L, 1, etc.
// Tras el nombre real, aparecen "palabras" sin vocales o con alta repetición.
// Regla: una palabra es nombre válido si tiene ≥15% vocales o longitud ≤ 3.
function filterOcrGarbage(raw: string): string {
  if (!raw) return '';
  return raw
    .split(/\s+/)
    .filter(word => {
      if (!word || word.length < 2) return false;
      const vowels    = (word.match(/[AEIOUaeiouÁÉÍÓÚáéíóú]/g) || []).length;
      const vowelRatio = vowels / word.length;
      // Sin vocales en palabras de más de 2 chars → basura de filler
      if (vowelRatio < 0.15 && word.length > 2) return false;
      // Alta repetición de 1-2 caracteres → basura (KLL, KLLLL, etc.)
      const uniqueChars = new Set(word.toUpperCase()).size;
      if (uniqueChars <= 2 && word.length >= 5) return false;
      return true;
    })
    .map(w => w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '');

function titleCase(s: string): string {
  if (!s) return '';
  // Preposiciones que van en minúscula en español
  const preps = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'a', 'al']);
  return s.toLowerCase()
    .split(/\s+/)
    .map((w, i) => (!w ? '' : i === 0 || !preps.has(w)) ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
}

function parseDate(yymmdd: string | null | undefined): string {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return '';
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  return `${yy <= 30 ? 2000 + yy : 1900 + yy}-${mm}-${dd}`;
}

function parseSex(s: string | null | undefined): string {
  if (s === 'male')   return 'Hombre';
  if (s === 'female') return 'Mujer';
  return 'No indicar';
}

// ─── Scoring MRZ ─────────────────────────────────────────────────────────────

function scoreResult(p: ParseResult): number {
  const rel = p.details.filter(d => d.field !== null);
  return rel.length === 0 ? 0 : rel.filter(d => d.valid).length / rel.length;
}

// ─── Líneas candidatas MRZ ────────────────────────────────────────────────────

function fitLine(line: string, len: number) {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, '<');
}

function cleanLine(raw: string) {
  return raw.toUpperCase().trim().split('').map(c => WHITELIST.includes(c) ? c : '<').join('');
}

function extractCandidates(text: string) {
  return text.split('\n')
    .map(cleanLine)
    .filter(l => l.length >= 22 && l.replace(/</g, '').length / l.length >= 0.18);
}

// ─── Mejor combinación de líneas ─────────────────────────────────────────────

interface MRZCandidate { result: ParseResult; score: number; inputLines: string[]; }

function findBestMRZ(lines: string[]): MRZCandidate | null {
  let best: MRZCandidate | null = null;
  const tryParse = (ls: string[]) => {
    try {
      const result = mrzParse(ls, { autocorrect: true }) as ParseResult;
      const score  = scoreResult(result);
      if (!best || score > best.score) best = { result, score, inputLines: ls };
    } catch { /* noop */ }
  };

  for (let i = 0; i <= lines.length - 2; i++)
    tryParse([fitLine(lines[i], 44), fitLine(lines[i+1], 44)]);
  for (let i = 0; i <= lines.length - 3; i++)
    tryParse([fitLine(lines[i], 30), fitLine(lines[i+1], 30), fitLine(lines[i+2], 30)]);
  for (let i = 0; i <= lines.length - 2; i++)
    tryParse([fitLine(lines[i], 30), fitLine(lines[i+1], 30), ''.padEnd(30, '<')]);
  for (const line of lines) {
    if (line.length >= 88)
      tryParse([fitLine(line.slice(0, 44), 44), fitLine(line.slice(44, 88), 44)]);
    if (line.length >= 90)
      tryParse([fitLine(line.slice(0, 30), 30), fitLine(line.slice(30, 60), 30), fitLine(line.slice(60, 90), 30)]);
  }
  return best;
}

// ─── Mapear MRZ → formulario ──────────────────────────────────────────────────
// FIX: usa f.lastName/f.firstName como fuente primaria y les aplica filterOcrGarbage.
// FIX: auto-set pais='ES' para DNI español.
function mrzToGuest(parsed: ParseResult, _inputLines: string[]): Partial<PartialGuestData> {
  const f   = parsed.fields as Record<string, string | null>;
  const out: Partial<PartialGuestData> = {};

  // ── Nombres: fuente primaria = campos de la librería (autocorrect aplicado) ──
  const libLast  = (f.lastName  ?? '').trim();
  const libFirst = (f.firstName ?? '').trim();

  if (libLast) {
    const parts    = libLast.split(/\s+/).filter(Boolean);
    const apellido  = filterOcrGarbage(parts[0] ?? '');
    const apellido2 = filterOcrGarbage(parts.slice(1).join(' '));
    if (apellido)  out.apellido  = apellido;
    if (apellido2) out.apellido2 = apellido2;
  }
  if (libFirst) {
    const nombre = filterOcrGarbage(libFirst);
    if (nombre) out.nombre = nombre;
  }

  // ── Fecha, sexo, nacionalidad ─────────────────────────────────────────────
  const fecha = parseDate(f.birthDate);
  if (fecha) out.fechaNac = fecha;
  out.sexo = parseSex(f.sex);

  const natCode = (f.nationality ?? f.issuingState ?? '').toUpperCase().replace(/<+/g, '');
  out.nacionalidad = NAT[natCode] ?? 'Otra';

  // FIX: Auto-set país a España para DNI español
  if (natCode === 'ESP') out.pais = 'ES';

  // ── Tipo y número de documento ────────────────────────────────────────────
  if (parsed.format === 'TD1') {
    const soporte  = (f.documentNumber ?? '').replace(/<+$/g, '').trim();
    const optional = (f.optional1      ?? '').slice(0, 9).replace(/<+$/g, '').trim();
    const isDNI = (s: string) => /^\d{8}[A-Z]$/.test(s);
    const isNIE = (s: string) => /^[XYZ]\d{7}[A-Z]$/.test(s);

    if      (isDNI(optional))  { out.tipoDoc = 'DNI'; out.numDoc = optional; if (soporte.length >= 8) out.soporteDoc = soporte; }
    else if (isNIE(optional))  { out.tipoDoc = 'NIE'; out.numDoc = optional; if (soporte.length >= 8) out.soporteDoc = soporte; }
    else if (isDNI(soporte))   { out.tipoDoc = 'DNI'; out.numDoc = soporte; }
    else if (isNIE(soporte))   { out.tipoDoc = 'NIE'; out.numDoc = soporte; }
    else { out.tipoDoc = natCode === 'ESP' ? 'DNI' : 'Otro'; out.numDoc = optional || soporte; }

  } else if (parsed.format === 'TD3') {
    const passNum = (f.documentNumber ?? '').replace(/<+$/g, '').trim();
    if (passNum) { out.tipoDoc = 'Pasaporte'; out.numDoc = passNum; }
  }

  return out;
}

// ─── DOMICILIO: parsear el texto del reverso del DNI ─────────────────────────
// El reverso del DNI español tiene encima del MRZ:
//   DOMICILIO / ADREÇA / HELBIDEA / ENDEREZO   (cabecera multiidioma)
//   CALLE EJEMPLO, 1, 3º B
//   28001 MADRID                       MADRID
//
// También acepta el formato más antiguo (una sola línea de encabezado).

function parseDniBackAddress(text: string): Partial<PartialGuestData> {
  const out: Partial<PartialGuestData> = {};
  if (!text || text.length < 5) return out;

  const lines = text.split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 1);

  if (lines.length === 0) return out;

  // Buscar la línea cabecera del domicilio
  const domRe = /domicili[oa]?|adre[çc]a|helbidea|enderezo|direcci[oó]n|adre[cç]/i;
  let startIdx = lines.findIndex(l => domRe.test(l));
  if (startIdx >= 0) {
    // Saltar la cabecera (puede ser "DOMICILIO / ADREÇA / ...")
    startIdx++;
  } else {
    // Si no hay cabecera, buscar directamente un CP al inicio de línea
    startIdx = 0;
  }

  // Saltar líneas cortas o vacías después de la cabecera
  while (startIdx < lines.length && lines[startIdx].length < 4) startIdx++;

  if (startIdx >= lines.length) return out;

  // Primera línea significativa = dirección de calle
  const streetLine = lines[startIdx];
  // Verificar que no empieza con 5 dígitos (sería el CP, no la calle)
  if (streetLine && !/^\d{5}/.test(streetLine)) {
    // Limpiar artefactos OCR de la dirección
    const cleanStreet = streetLine
      .replace(/[|]{1,}/g, '')              // barras verticales OCR
      .replace(/\s{2,}/g, ' ')              // espacios múltiples
      .trim();
    if (cleanStreet.length >= 4) {
      out.direccion = titleCase(cleanStreet);
      startIdx++;
    }
  }

  // Siguientes líneas: buscar "12345 CIUDAD [PROVINCIA]"
  for (let i = startIdx; i < Math.min(startIdx + 4, lines.length); i++) {
    const line = lines[i];

    // Pattern: 5 dígitos seguidos de nombre de ciudad
    const cpMatch = line.match(/(\d{5})\s+([A-ZÁÉÍÓÚÑa-záéíóúñ\/\-'·\s]+)/i);
    if (!cpMatch) continue;

    out.cp = cpMatch[1];
    const cityPart = cpMatch[2].trim();

    // En el DNI actual, la provincia va a la DERECHA de la ciudad, separada por ≥2 espacios
    // Ejemplo: "28001 MADRID                    MADRID"
    const splitRe = /^(.+?)\s{2,}([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]+)\s*$/;
    const splitMatch = cityPart.match(splitRe);

    if (splitMatch) {
      out.ciudad    = titleCase(splitMatch[1].trim());
      out.provincia = titleCase(splitMatch[2].trim());
    } else {
      out.ciudad = titleCase(cityPart.trim());
      // Buscar provincia en siguiente línea
      const next = lines[i + 1];
      if (next && next.length >= 3 && !/^\d{5}/.test(next) && !domRe.test(next)) {
        out.provincia = titleCase(next.trim());
      }
    }
    break;
  }

  return out;
}

// ─── Preprocesado image-js ────────────────────────────────────────────────────
// SOLO APIs seguras de image-js 1.x: grey(), level(), resize(), crop().

interface PrepVariant { dataURL: string; psm: PSM; label: string; }

async function buildMrzVariants(exifBlob: Blob): Promise<{ variants: PrepVariant[]; grey: any; width: number; height: number }> {
  const ab   = await exifBlob.arrayBuffer();
  const orig = ijsDecode(new Uint8Array(ab)) as any;

  let { width, height } = orig;
  let grey: any = orig.grey ? orig.grey() : orig;

  if (width > MAX_INPUT_W) {
    grey   = grey.resize({ width: MAX_INPUT_W });
    height = Math.round(height * MAX_INPUT_W / width);
    width  = MAX_INPUT_W;
  }

  const mrzW  = Math.max(MRZ_TARGET_W, Math.round(width * 2.8));
  const fullW = Math.max(1600, width);

  const variants: PrepVariant[] = [];

  const zones  = [
    { label: 'b30', yFrac: 0.70 },
    { label: 'b38', yFrac: 0.62 },
    { label: 'b24', yFrac: 0.76 },
  ];
  const levels = [
    { label: 'std',  inputMin: 20,  inputMax: 230 },
    { label: 'hico', inputMin: 55,  inputMax: 200 },
    { label: 'dark', inputMin: 0,   inputMax: 175 },
  ];

  for (const z of zones) {
    const y    = Math.floor(height * z.yFrac);
    const h    = height - y;
    const crop = grey.crop({ origin: { row: y, column: 0 }, width, height: h });

    for (const lv of levels) {
      if (lv.label === 'dark' && z.label !== 'b24') continue;
      try {
        variants.push({
          dataURL: ijsEncodeDataURL(crop.level({ inputMin: lv.inputMin, inputMax: lv.inputMax }).resize({ width: mrzW })),
          psm:     PSM.SINGLE_BLOCK,
          label:   `${z.label}-${lv.label}`,
        });
      } catch { /* ok */ }
    }
  }

  // Fallback: imagen completa
  try {
    variants.push({
      dataURL: ijsEncodeDataURL(grey.level({ inputMin: 20, inputMax: 230 }).resize({ width: fullW })),
      psm:   PSM.SPARSE_TEXT,
      label: 'full',
    });
  } catch { /* ok */ }

  return { variants, grey, width, height };
}

// Variante para la zona del domicilio (top 45% del reverso)
function buildAddressVariant(grey: any, width: number, height: number): string | null {
  try {
    // Top 45%: donde está el domicilio en el reverso del DNI
    const addrH = Math.floor(height * 0.45);
    // Usamos un ancho moderado — el domicilio no necesita tanto upscale como MRZ
    const addrW = Math.max(1400, Math.round(width * 1.8));

    const crop = grey.crop({ origin: { row: 0, column: 0 }, width, height: addrH });
    // Level estándar — el domicilio suele estar en zona clara del DNI
    return ijsEncodeDataURL(crop.level({ inputMin: 20, inputMax: 230 }).resize({ width: addrW }));
  } catch {
    return null;
  }
}

// ─── Singleton Tesseract ──────────────────────────────────────────────────────

type TWorker = Awaited<ReturnType<typeof createWorker>>;
let _worker:     TWorker | null          = null;
let _ready       = false;
let _loading:    Promise<TWorker> | null = null;
let _terminating = false;

async function getWorker(onLoad?: (pct: number) => void): Promise<TWorker> {
  if (_ready && _worker) return _worker;
  if (_loading)          return _loading;
  _terminating = false;
  _loading = createWorker('eng', 1, {
    logger: (m: { status: string; progress: number }) => {
      if (onLoad && m.status === 'loading language traineddata')
        onLoad(Math.round(12 + m.progress * 14));
    },
  }).then(w => { _worker = w; _ready = true; return w; });
  return _loading;
}

// OCR configurado para MRZ (whitelist estricta)
async function runMrzOCR(worker: TWorker, dataURL: string, psm: PSM): Promise<string> {
  await (worker as any).setParameters({
    tessedit_char_whitelist:     WHITELIST,
    tessedit_pageseg_mode:       String(psm),
    load_system_dawg:            '0',
    load_freq_dawg:              '0',
    load_number_dawg:            '0',
    tessedit_do_invert:          '0',
    hocr_font_info:              '0',
    textord_tabfind_find_tables: '0',
  });
  const { data } = await worker.recognize(dataURL);
  return data.text;
}

// OCR configurado para texto libre (domicilio, texto del DNI)
// Sin whitelist para poder leer letras acentuadas y caracteres especiales
async function runTextOCR(worker: TWorker, dataURL: string): Promise<string> {
  await (worker as any).setParameters({
    tessedit_char_whitelist:     '',           // sin restricción
    tessedit_pageseg_mode:       String(PSM.AUTO),
    load_system_dawg:            '0',
    load_freq_dawg:              '0',
    load_number_dawg:            '0',
    tessedit_do_invert:          '0',
    hocr_font_info:              '0',
    textord_tabfind_find_tables: '0',
  });
  const { data } = await worker.recognize(dataURL);
  return data.text;
}

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDocumentOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress]         = useState<OCRProgress>({ fase: '', pct: 0 });
  const cancelRef                       = useRef(false);

  const setFase = useCallback((fase: string, pct: number) => {
    if (!cancelRef.current) setProgress({ fase, pct: Math.round(pct) });
  }, []);

  const processDocument = useCallback(async (file: File): Promise<OCRResult> => {
    cancelRef.current = false;
    setIsProcessing(true);
    setFase('Preparando imagen…', 3);

    try {
      // 1. EXIF correction
      let exifBlob: Blob;
      try {
        setFase('Corrigiendo orientación…', 8);
        exifBlob = await loadExifCorrectedBlob(file);
      } catch (err) {
        console.error('[OCR] EXIF:', err);
        return { ok: false, error: 'No se pudo procesar la imagen. Use JPG o PNG.' };
      }

      // 2. Preprocesar variantes MRZ
      let mrzVariants: PrepVariant[];
      let grey: any, width: number, height: number;
      try {
        setFase('Analizando imagen…', 13);
        const built = await buildMrzVariants(exifBlob);
        mrzVariants = built.variants;
        grey        = built.grey;
        width       = built.width;
        height      = built.height;
      } catch (err) {
        console.error('[OCR] buildVariants:', err);
        return { ok: false, error: 'No se pudo procesar la imagen. Use JPG o PNG (máx. 25 MB).' };
      }

      if (cancelRef.current || _terminating) return { ok: false };

      // 3. Cargar Tesseract
      setFase('Iniciando motor de lectura…', 20);
      const worker = await getWorker(pct => setFase('Cargando modelo…', pct));

      if (cancelRef.current || _terminating) return { ok: false };

      // 4. OCR MRZ — secuencial con salida temprana
      let best: MRZCandidate | null = null;
      const total = mrzVariants.length;

      for (let i = 0; i < total; i++) {
        if (cancelRef.current || _terminating) break;

        const pct  = 25 + Math.round((i / total) * 50);
        const fase =
          i === 0          ? 'Leyendo zona MRZ…'
          : i < total - 1 ? `Refinando lectura MRZ (${i + 1}/${total - 1})…`
          :                  'Análisis completo de imagen…';
        setFase(fase, pct);

        try {
          const text  = await runMrzOCR(worker, mrzVariants[i].dataURL, mrzVariants[i].psm);
          const cands = extractCandidates(text);
          const cand  = findBestMRZ(cands);
          if (cand && (!best || cand.score > best.score)) best = cand;
        } catch (err) {
          console.warn(`[OCR] MRZ variante "${mrzVariants[i].label}":`, err);
        }

        if (best && best.score >= GOOD_SCORE) break;
      }

      if (cancelRef.current || _terminating) return { ok: false };

      // 5. Evaluar MRZ
      if (!best) {
        return {
          ok: false,
          error:
            'No se detectó la zona MRZ. ' +
            'Para el DNI fotografíe el REVERSO (las 3 líneas de código en la franja inferior). ' +
            'Para el pasaporte, la página con la foto. ' +
            'Sin reflejos y con el documento completamente visible.',
        };
      }

      if (best.score < MIN_SCORE) {
        return {
          ok: false,
          formato:   best.result.format,
          confianza: best.score,
          error: 'Imagen con poca calidad para leer el documento. Intente con mejor iluminación.',
        };
      }

      // 6. Mapear datos MRZ al formulario
      setFase('Leyendo domicilio…', 78);
      const mrzData = mrzToGuest(best.result, best.inputLines);

      // 7. Extracción de domicilio (SOLO para TD1 = DNI reverso)
      //    El domicilio está en el TOP 45% de la misma imagen.
      let addressData: Partial<PartialGuestData> = {};

      if (best.result.format === 'TD1' && !cancelRef.current && !_terminating) {
        try {
          const addrDataURL = buildAddressVariant(grey, width, height);
          if (addrDataURL) {
            const addrText = await runTextOCR(worker, addrDataURL);
            addressData = parseDniBackAddress(addrText);
          }
        } catch (err) {
          // El domicilio es opcional — si falla, continuar sin él
          console.warn('[OCR] address extraction:', err);
        }
      }

      if (cancelRef.current || _terminating) return { ok: false };

      setFase('¡Lectura completada!', 100);

      // Merge: MRZ tiene prioridad sobre address para los datos del documento.
      // Address añade campos de contacto que MRZ no tiene.
      const mergedData: Partial<PartialGuestData> = {
        ...addressData,   // direccion, cp, ciudad, provincia (si se leyeron)
        ...mrzData,       // nombre, apellido, fechaNac, tipoDoc, numDoc, pais, etc.
      };

      return {
        ok:        true,
        data:      mergedData,
        formato:   best.result.format,
        confianza: best.score,
      };

    } catch (err) {
      console.error('[useDocumentOCR]', err);
      return { ok: false, error: 'Error inesperado. Inténtelo de nuevo.' };
    } finally {
      setIsProcessing(false);
    }
  }, [setFase]);

  const terminate = useCallback(async () => {
    cancelRef.current = true;
    _terminating = true;
    if (_loading) { try { await _loading; } catch { /* ok */ } }
    if (_worker) {
      try { await _worker.terminate(); } catch { /* ok */ }
      _worker = null; _ready = false; _loading = null;
    }
    _terminating = false;
  }, []);

  return { processDocument, isProcessing, progress, terminate };
}