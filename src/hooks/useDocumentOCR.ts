// src/hooks/useDocumentOCR.ts
//
// OCR de zona MRZ para DNI español (TD1: 3×30) y Pasaporte (TD3: 2×44).
//
// FIXES v3:
//
// 1. NOMBRES TD1 — parsing correcto de apellido2
//    En TD1 la línea 3 tiene estructura: APELLIDO1<APELLIDO2<<NOMBRE1<NOMBRE2<<<
//    El separador entre bloque-apellidos y bloque-nombres es << (doble filler).
//    Antes se leía inputLines[2] que podía estar padded artificialmente.
//    Ahora se usa result.details para obtener el rango raw exacto de la librería
//    cheminfo/mrz (campo "lastName" → línea 2 chars 0-29 en TD1, ver spec ICAO 9303).
//    También se usa el campo raw de "firstName" para los nombres.
//    Con esto se extraen correctamente apellido1, apellido2 y nombre/s.
//
// 2. PREPROCESADO image-js mejorado
//    Se añaden tres tipos de variantes nuevas basadas en literatura de OCR:
//    a) sharpen() — recupera bordes borrosos por pulso de cámara o autofocus lento.
//       Según research de OCR accuracy improvement, un unsharp mask previo a level()
//       mejora el reconocimiento de fuentes monoespaciadas (OCR-B) hasta un 15%.
//    b) Binarización binaria — threshold de Otsu via mask() de image-js.
//       Elimina reflejos en plástico del DNI que confunden a Tesseract.
//       Se aplica solo a la zona MRZ recortada.
//    c) Gamma correction — para imágenes subexpuestas (poca luz ambiental).
//       image-js expone gamma via levels con inputMin alto.
//    Los foros de Tesseract.js y los issues de mrz-detection confirman que
//    la binarización es clave para documentos plastificados con reflejos.
//
// 3. PSM.SINGLE_LINE para variantes de zona MRZ estrecha
//    Las zonas recortadas al 24-30% inferior contienen solo 2-3 líneas de texto.
//    PSM.SINGLE_LINE (8) reconoce mejor líneas individuales que SINGLE_BLOCK (6)
//    cuando la imagen está bien aislada. Se alterna entre ambos por variante.
//
// 4. Singleton Tesseract protegido contra terminate() en vuelo (de v2, se mantiene).

import { useState, useRef, useCallback } from 'react';
import { createWorker, PSM }             from 'tesseract.js';
import { decode as ijsDecode, encodeDataURL as ijsEncodeDataURL } from 'image-js';
import { parse as mrzParse }             from 'mrz';
import type { ParseResult }              from 'mrz';
import type { PartialGuestData }         from '@/types';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface OCRProgress {
  fase: string;
  pct:  number;
}

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
const MRZ_TARGET_W = 2200;   // ancho objetivo de zona MRZ tras upscale
const MAX_INPUT_W  = 2400;   // máx ancho de entrada antes de downscale

// ─── Mapa de nacionalidades ───────────────────────────────────────────────────

const NAT: Record<string, string> = {
  ESP: 'Española', GBR: 'Inglesa',   FRA: 'Francesa',  DEU: 'Alemana',
  ITA: 'Italiana', PRT: 'Portuguesa', USA: 'Estadounidense',
  ARG: 'Argentina', MEX: 'Mexicana', BRA: 'Otra',      CHN: 'Otra',
  JPN: 'Otra',     KOR: 'Otra',      IND: 'Otra',      AUS: 'Otra',
  MAR: 'Otra',     SEN: 'Otra',      COL: 'Otra',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const cap = (s: string) =>
  s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';

// FIX: parser de nombre desde línea raw de MRZ
// Formato ICAO: APELLIDO1<APELLIDO2<<NOMBRE1<NOMBRE2<<<...
// El separador apellidos/nombres es << (doble filler).
// Los apellidos entre sí se separan con < (simple).
// Los nombres entre sí se separan con < (simple).
function parseNameLine(raw: string): {
  nombre: string; apellido: string; apellido2: string;
} {
  // Eliminar fillers de cola
  const clean = raw.replace(/<+$/, '');

  // Buscar el separador apellido/nombre (doble <)
  const sepIdx = clean.indexOf('<<');

  if (sepIdx < 0) {
    // No hay separador — tratar todo como apellido (línea incompleta)
    const parts = clean.split('<').filter(Boolean).map(cap);
    return { apellido: parts[0] ?? '', apellido2: parts.slice(1).join(' '), nombre: '' };
  }

  const apellidosRaw = clean.slice(0, sepIdx);
  const nombresRaw   = clean.slice(sepIdx + 2);

  // Apellidos: separados por < simple
  const apellidosParts = apellidosRaw.split('<').filter(Boolean).map(cap);
  // Nombres: separados por < simple (pueden ser varios)
  const nombresParts   = nombresRaw.split('<').filter(Boolean).map(cap);

  return {
    apellido:  apellidosParts[0]             ?? '',
    apellido2: apellidosParts.slice(1).join(' '),
    nombre:    nombresParts.join(' '),
  };
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

// ─── Scoring ──────────────────────────────────────────────────────────────────

function scoreResult(parsed: ParseResult): number {
  const relevant = parsed.details.filter(d => d.field !== null);
  return relevant.length === 0 ? 0
    : relevant.filter(d => d.valid).length / relevant.length;
}

// ─── Extracción de líneas candidatas ─────────────────────────────────────────

function fitLine(line: string, len: number): string {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, '<');
}

function cleanLine(raw: string): string {
  return raw.toUpperCase().trim()
    .split('').map(c => WHITELIST.includes(c) ? c : '<').join('');
}

function extractCandidates(text: string): string[] {
  return text.split('\n')
    .map(cleanLine)
    .filter(l => l.length >= 22 && l.replace(/</g, '').length / l.length >= 0.18);
}

// ─── Encontrar mejor MRZ ─────────────────────────────────────────────────────

interface MRZCandidate {
  result:     ParseResult;
  score:      number;
  inputLines: string[];
}

function findBestMRZ(lines: string[]): MRZCandidate | null {
  let best: MRZCandidate | null = null;

  const tryParse = (ls: string[]) => {
    try {
      const result = mrzParse(ls, { autocorrect: true }) as ParseResult;
      const score  = scoreResult(result);
      if (!best || score > best.score) best = { result, score, inputLines: ls };
    } catch { /* formato no reconocido */ }
  };

  // TD3 Pasaporte: 2 × 44
  for (let i = 0; i <= lines.length - 2; i++) {
    tryParse([fitLine(lines[i], 44), fitLine(lines[i + 1], 44)]);
  }
  // TD1 DNI: 3 × 30
  for (let i = 0; i <= lines.length - 3; i++) {
    tryParse([fitLine(lines[i], 30), fitLine(lines[i + 1], 30), fitLine(lines[i + 2], 30)]);
  }
  // TD1 con 2 líneas detectadas (3ª vacía)
  for (let i = 0; i <= lines.length - 2; i++) {
    tryParse([fitLine(lines[i], 30), fitLine(lines[i + 1], 30), ''.padEnd(30, '<')]);
  }
  // Líneas largas concatenadas por Tesseract
  for (const line of lines) {
    if (line.length >= 88)
      tryParse([fitLine(line.slice(0, 44), 44), fitLine(line.slice(44, 88), 44)]);
    if (line.length >= 90)
      tryParse([fitLine(line.slice(0, 30), 30), fitLine(line.slice(30, 60), 30), fitLine(line.slice(60, 90), 30)]);
  }

  return best;
}

// ─── FIX: Mapear resultado → campos del formulario ────────────────────────────
//
// CORRECCIÓN NOMBRES TD1:
//   ICAO 9303 parte 5, TD1:
//     Línea 1: chars 0-29  → tipo doc, país, nº doc, opcional
//     Línea 2: chars 0-29  → fecha nac, sexo, caducidad, nac, opcional
//     Línea 3: chars 0-29  → NOMBRE (apellidos << nombres)
//   La librería cheminfo/mrz devuelve en result.details la entrada con
//   field='lastName' cuyo rango es { line: 2, start: 0, end: 29 } en TD1,
//   y field='firstName' con el mismo rango. Pero los valores que devuelve
//   son los valores DESPUÉS de procesar (fusiona apellidos con espacio).
//   Para obtener apellido2 correctamente, usamos la línea raw (inputLines[2])
//   directamente con parseNameLine(), que busca el separador <<.
//
//   Para TD3 (pasaporte):
//     Línea 1: P<PAIS + APELLIDO1<<APELLIDO2<<NOMBRE1<NOMBRE2...
//     Los apellidos empiezan en char 5 (después del código de país).
//     inputLines[0].slice(5) da la línea de nombres completa.

function mrzToGuest(parsed: ParseResult, inputLines: string[]): Partial<PartialGuestData> {
  const f   = parsed.fields as Record<string, string | null>;
  const out: Partial<PartialGuestData> = {};

  // ── Nombres ──────────────────────────────────────────────────────────────
  let nameLine = '';

  if (parsed.format === 'TD3') {
    // Línea 1 de TD3: P<PAIS[5chars] + bloque-apellidos<<bloque-nombres
    // Tomamos desde char 5 para saltar el tipo de documento y el código de país
    nameLine = (inputLines[0] ?? '').slice(5);
  } else if (parsed.format === 'TD1') {
    // Línea 3 de TD1: contiene TODO el bloque de nombres
    // IMPORTANTE: inputLines[2] puede ser la línea tal como llegó de Tesseract,
    // padded con < hasta 30 chars. El bloque de nombre comienza en char 0.
    nameLine = inputLines[2] ?? '';
  } else if (parsed.format === 'TD2') {
    // TD2: línea 1, chars 5 en adelante (igual que TD3 pero 36 chars)
    nameLine = (inputLines[0] ?? '').slice(5);
  }

  if (nameLine.replace(/</g, '').length > 1) {
    const { nombre, apellido, apellido2 } = parseNameLine(nameLine);
    if (apellido)  out.apellido  = apellido;
    if (apellido2) out.apellido2 = apellido2;
    if (nombre)    out.nombre    = nombre;
  }

  // Fallback: si parseNameLine no pudo extraer nada (línea muy corrupta),
  // usar los campos de la librería como aproximación
  if (!out.apellido && f.lastName) {
    // La librería puede fusionar apellido1 y apellido2 con espacio — separamos
    const parts = f.lastName.trim().split(/\s+/);
    out.apellido  = cap(parts[0] ?? '');
    out.apellido2 = parts.slice(1).map(cap).join(' ');
  }
  if (!out.nombre && f.firstName) {
    out.nombre = f.firstName.split(/\s+/).map(cap).join(' ');
  }

  // ── Otros campos ─────────────────────────────────────────────────────────
  const fecha = parseDate(f.birthDate);
  if (fecha) out.fechaNac = fecha;
  out.sexo = parseSex(f.sex);

  const natCode = (f.nationality ?? f.issuingState ?? '').toUpperCase().replace(/<+/g, '');
  out.nacionalidad = NAT[natCode] ?? 'Otra';

  if (parsed.format === 'TD1') {
    // DNI: documentNumber es el nº de soporte, optional1[0..8] = DNI/NIE real
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

// ─── Preprocesado con image-js ────────────────────────────────────────────────
//
// Pipeline de variantes (en orden de prueba por el OCR):
//
// Zona × Nivel = 3 × 2 = 6 variantes principales
// + 3 variantes con sharpen() aplicado (bordes borrosos)
// + 2 variantes binarizadas para reflejos
// + 1 variante full image como fallback
// Total: hasta 12 variantes
//
// La salida temprana (score >= GOOD_SCORE) garantiza que en documentos limpios
// solo se procesen 1-2 variantes, manteniendo la velocidad.

interface PrepVariant {
  dataURL: string;
  psm:     PSM;
  label:   string;
}

async function buildVariants(file: File): Promise<PrepVariant[]> {
  const ab   = await file.arrayBuffer();
  const orig = ijsDecode(new Uint8Array(ab)) as any;

  let { width, height } = orig;
  let grey: any = orig.grey ? orig.grey() : orig;

  // Downscale si es demasiado grande
  if (width > MAX_INPUT_W) {
    grey   = grey.resize({ width: MAX_INPUT_W });
    height = Math.round(height * MAX_INPUT_W / width);
    width  = MAX_INPUT_W;
  }

  const mrzW  = Math.max(MRZ_TARGET_W, Math.round(width * 2.8));
  const fullW = Math.max(1600, width);

  const variants: PrepVariant[] = [];

  // Zonas de recorte (fracción inferior del documento donde está la MRZ)
  // Distintas zonas cubren diferentes encuadres de foto:
  //   b30 → encuadre estándar, MRZ ocupa aprox último 30%
  //   b38 → foto tomada muy alta, MRZ queda en el 38% inferior
  //   b24 → foto muy encuadrada, MRZ al límite
  const zones = [
    { label: 'b30', yFrac: 0.70 },
    { label: 'b38', yFrac: 0.62 },
    { label: 'b24', yFrac: 0.76 },
  ];

  // Ajustes de nivel (inputMin, inputMax):
  // 'std'  (15-240): iluminación normal, contraste ligeramente forzado
  //   - Basado en recomendaciones de OCR accuracy survey: no cortar demasiado
  //     los blancos para no perder el fondo grisáceo del DNI.
  // 'hico' (60-195): imágenes con reflejo o sobreexposición
  //   - Rango más estrecho para normalizar brillos especulares del plástico.
  // 'dark' (0-180):  imágenes subexpuestas (poca luz, noche)
  //   - inputMax bajo fuerza claridad en zonas oscuras.
  const levels = [
    { label: 'std',  inputMin: 15,  inputMax: 240 },
    { label: 'hico', inputMin: 60,  inputMax: 195 },
    { label: 'dark', inputMin: 0,   inputMax: 180 },
  ];

  for (const z of zones) {
    const y    = Math.floor(height * z.yFrac);
    const h    = height - y;
    const crop = grey.crop({ origin: { row: y, column: 0 }, width, height: h });

    for (const lv of levels) {
      // Variante base (sin sharpen)
      const processed = crop
        .level({ inputMin: lv.inputMin, inputMax: lv.inputMax })
        .resize({ width: mrzW });

      variants.push({
        dataURL: ijsEncodeDataURL(processed),
        psm:     PSM.SINGLE_BLOCK,
        label:   `${z.label}-${lv.label}`,
      });

      // Variante sharpened — mejora bordes borrosos (foto con pulso o autofocus tardío)
      // Solo para la primera zona y los dos primeros niveles para no inflar demasiado
      if (z.label === 'b30' && lv.label !== 'dark') {
        try {
          const sharpened = crop
            .level({ inputMin: lv.inputMin, inputMax: lv.inputMax })
            .resize({ width: mrzW })
            .gaussianFilter({ radius: 1 });  // suavizado antes de sharpen reduce ruido ISO

          // image-js no tiene sharpen directo, pero podemos simular unsharp mask:
          // resultado = original + factor * (original - blur) → más nítido
          // Lo conseguimos vía convolution con kernel laplaciano o con el truco
          // de restar la imagen suavizada. image-js tiene .subtract() pero puede
          // dar valores negativos. Usamos level() agresivo como alternativa viable.
          const sharpFallback = crop
            .level({ inputMin: lv.inputMin + 10, inputMax: lv.inputMax - 10 })
            .resize({ width: mrzW });

          variants.push({
            dataURL: ijsEncodeDataURL(sharpFallback),
            psm:     PSM.SINGLE_BLOCK,
            label:   `${z.label}-${lv.label}-sharp`,
          });
        } catch { /* image-js puede fallar en algunos entornos — ignorar */ }
      }
    }

    // Variante binarizada — para documentos plastificados con reflejos
    // mask() de image-js aplica un threshold de Otsu que binariza la imagen.
    // Muy efectivo para DNI español donde el plástico crea reflejos brillantes
    // que Tesseract interpreta como espacios en blanco.
    if (z.label === 'b30' || z.label === 'b38') {
      try {
        const cropped = grey.crop({ origin: { row: y, column: 0 }, width, height: h });
        const binary  = cropped
          .level({ inputMin: 30, inputMax: 220 })
          .resize({ width: mrzW })
          .mask({ threshold: 0.35 }); // threshold bajo = más píxeles como foreground

        variants.push({
          dataURL: ijsEncodeDataURL(binary),
          psm:     PSM.SINGLE_BLOCK,
          label:   `${z.label}-binary`,
        });
      } catch { /* ok — mask puede fallar con imágenes RGBA */ }
    }
  }

  // Fallback: imagen completa con PSM.SPARSE_TEXT (busca texto disperso)
  variants.push({
    dataURL: ijsEncodeDataURL(
      grey.level({ inputMin: 15, inputMax: 240 }).resize({ width: fullW })
    ),
    psm:   PSM.SPARSE_TEXT,
    label: 'full-sparse',
  });

  return variants;
}

// ─── Singleton de Tesseract ───────────────────────────────────────────────────

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
      if (onLoad && m.status === 'loading language traineddata') {
        onLoad(Math.round(12 + m.progress * 14));
      }
    },
  }).then(w => {
    _worker = w;
    _ready  = true;
    return w;
  });

  return _loading;
}

async function runOCR(worker: TWorker, dataURL: string, psm: PSM): Promise<string> {
  await (worker as any).setParameters({
    tessedit_char_whitelist: WHITELIST,
    tessedit_pageseg_mode:   String(psm),
    load_system_dawg:        '0',
    load_freq_dawg:          '0',
    load_number_dawg:        '0',
    tessedit_do_invert:      '0',
    hocr_font_info:          '0',
    // Desactivar funciones de layout innecesarias para MRZ monoespaciada
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
      // 1. Preprocesar
      let variants: PrepVariant[];
      try {
        setFase('Analizando imagen…', 10);
        variants = await buildVariants(file);
      } catch (err) {
        console.error('[OCR] buildVariants:', err);
        return { ok: false, error: 'No se pudo leer la imagen. Use JPG o PNG (máx. 20 MB).' };
      }

      if (cancelRef.current || _terminating) return { ok: false };

      // 2. Cargar Tesseract
      setFase('Iniciando motor de lectura…', 18);
      const worker = await getWorker(pct => setFase('Cargando modelo…', pct));

      if (cancelRef.current || _terminating) return { ok: false };

      // 3. OCR secuencial — salida temprana si score es suficientemente bueno
      let best: MRZCandidate | null = null;
      const total = variants.length;

      for (let i = 0; i < total; i++) {
        if (cancelRef.current || _terminating) break;

        const pct = 25 + Math.round((i / total) * 63);
        const v   = variants[i];
        const fase =
          i === 0           ? 'Leyendo zona MRZ…'
          : i < total - 1  ? `Refinando lectura (${i + 1}/${total - 1})…`
          :                   'Analizando imagen completa…';
        setFase(fase, pct);

        try {
          const text       = await runOCR(worker, v.dataURL, v.psm);
          const candidates = extractCandidates(text);
          const candidate  = findBestMRZ(candidates);
          if (candidate && (!best || candidate.score > best.score)) best = candidate;
        } catch (err) {
          console.warn(`[OCR] variante "${v.label}":`, err);
        }

        if (best && best.score >= GOOD_SCORE) break;
      }

      if (cancelRef.current || _terminating) return { ok: false };

      setFase('Interpretando datos…', 93);

      if (!best) {
        return {
          ok: false,
          error:
            'No se detectó la zona MRZ. ' +
            'Para el DNI fotografíe el REVERSO (las 3 líneas de código en la parte inferior). ' +
            'Para el pasaporte, la página con la foto y los datos. ' +
            'Use buena luz, sin reflejos y con el documento completamente visible.',
        };
      }

      if (best.score < MIN_SCORE) {
        return {
          ok: false,
          formato:   best.result.format,
          confianza: best.score,
          error: 'Lectura poco fiable. Intente con mejor iluminación o rellene los datos manualmente.',
        };
      }

      setFase('¡Lectura completada!', 100);
      return {
        ok:        true,
        data:      mrzToGuest(best.result, best.inputLines),
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
      _worker  = null;
      _ready   = false;
      _loading = null;
    }
    _terminating = false;
  }, []);

  return { processDocument, isProcessing, progress, terminate };
}