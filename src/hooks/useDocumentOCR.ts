// src/hooks/useDocumentOCR.ts
// npm install tesseract.js mrz image-js

import { useState, useRef, useCallback } from 'react';
import { createWorker, PSM } from 'tesseract.js';
import { decode as ijsDecode, encodeDataURL as ijsEncodeDataURL } from 'image-js';
import { parse as mrzParse } from 'mrz';
// Importar ParseResult directamente — evita que ReturnType<typeof mrzParse> infiera 'never'
import type { ParseResult } from 'mrz';
import type { PartialGuestData } from '@/types';

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface OCRProgress { fase: string; pct: number }
export interface OCRResult {
  ok: boolean;
  data?: Partial<PartialGuestData>;
  formato?: string | null;
  confianza?: number;
  error?: string;
}

type TWorker = Awaited<ReturnType<typeof createWorker>>;

// Tipado explícito de MRZCandidate con ParseResult (no ReturnType<typeof mrzParse>)
interface MRZCandidate {
  result: ParseResult;
  lines: string[];
  score: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

const NAT: Record<string, string> = {
  ESP: 'Española', GBR: 'Inglesa',  FRA: 'Francesa', DEU: 'Alemana',
  ITA: 'Italiana', PRT: 'Portuguesa', USA: 'Estadounidense',
  ARG: 'Argentina', MEX: 'Mexicana', BRA: 'Otra', CHN: 'Otra',
};

// ─── Utilidades ───────────────────────────────────────────────────────────────

const cap = (s: string) => s ? s[0].toUpperCase() + s.slice(1).toLowerCase() : '';

function parseNameLine(raw: string): { nombre: string; apellido: string; apellido2: string } {
  const clean = raw.replace(/<+$/, '');
  const sep = clean.indexOf('<<');
  const surnameBlock = sep >= 0 ? clean.slice(0, sep) : clean;
  const givenBlock   = sep >= 0 ? clean.slice(sep + 2) : '';
  const surnames = surnameBlock.split('<').filter(Boolean).map(cap);
  const given    = givenBlock.split('<').filter(Boolean).map(cap);
  return {
    apellido:  surnames[0] ?? '',
    apellido2: surnames.slice(1).join(' '),
    nombre:    given.join(' '),
  };
}

function parseDate(yymmdd: string | null | undefined): string {
  if (!yymmdd || yymmdd.length !== 6 || !/^\d{6}$/.test(yymmdd)) return '';
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return '';
  return `${yy < 30 ? 2000 + yy : 1900 + yy}-${mm}-${dd}`;
}

function parseSex(s: string | null | undefined): string {
  if (s === 'male')   return 'Hombre';
  if (s === 'female') return 'Mujer';
  return 'No indicar';
}

// ─── Preprocesado ─────────────────────────────────────────────────────────────

interface PrepImages {
  mrzNarrow: string; mrzNarrowE: string; mrzWide: string; full: string;
}

async function prepareImages(file: File): Promise<PrepImages> {
  const ab   = await file.arrayBuffer();
  const orig = ijsDecode(new Uint8Array(ab));
  const { width, height } = orig;
  const grey = orig.grey();

  const y30  = Math.floor(height * 0.70);
  const h30  = height - y30;
  const w3x  = Math.max(Math.round(width * 3), 1800);
 const mrzBase = grey.crop({
  origin: { row: y30, column: 0 },
  width: width,
  height: h30,
});

  const y45  = Math.floor(height * 0.55);
  const h45  = height - y45;
  const w25x = Math.max(Math.round(width * 2.5), 1400);

  return {
    mrzNarrow:  ijsEncodeDataURL(mrzBase.level({ inputMin: 40, inputMax: 215 }).resize({ width: w3x })),
    mrzNarrowE: ijsEncodeDataURL(mrzBase.level({ inputMin: 60, inputMax: 200 }).increaseContrast().resize({ width: w3x })),
    mrzWide:    ijsEncodeDataURL(grey.crop({
  origin: { row: y45, column: 0 },
  width: width,
  height: h45,
}).level({ inputMin: 40, inputMax: 215 }).resize({ width: w25x })),
    full:       ijsEncodeDataURL(grey.level({ inputMin: 40, inputMax: 215 }).resize({ width: Math.max(width, 1400) })),
  };
}

// ─── OCR ─────────────────────────────────────────────────────────────────────

async function runOCR(worker: TWorker, dataURL: string, psm: PSM): Promise<string> {
  // Los parámetros internos de Tesseract no están en sus tipos públicos — cast puntual
  const params = {
    tessedit_char_whitelist: WHITELIST,
    tessedit_pageseg_mode:   String(psm),
    load_system_dawg:        '0',
    load_freq_dawg:          '0',
    load_number_dawg:        '0',
  } as unknown as Parameters<TWorker['setParameters']>[0];
  await worker.setParameters(params);
  const { data } = await worker.recognize(dataURL);
  return data.text;
}

// ─── Líneas candidatas ────────────────────────────────────────────────────────

function extractLines(ocrText: string): string[] {
  return ocrText
    .split('\n')
    .map(raw => raw.toUpperCase().trim().split('').map(c => WHITELIST.includes(c) ? c : '<').join(''))
    .filter(line => line.length >= 20 && line.replace(/</g, '').length / line.length >= 0.3);
}

function fitLine(line: string, len: number): string {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, '<');
}

// ─── Búsqueda de MRZ ─────────────────────────────────────────────────────────

function scoreResult(parsed: ParseResult): number {
  const total = parsed.details.filter(d => d.field !== null).length;
  if (total === 0) return 0;
  return parsed.details.filter(d => d.field !== null && d.valid).length / total;
}

function findbestRefMRZ(candidates: string[]): MRZCandidate | null {
  // contenedor para no perder el tipo en closures async
  const bestRef = { current: null as MRZCandidate | null };

  const tryParse = (lines: string[]) => {
    try {
      const parsed = mrzParse(lines, { autocorrect: true }) as ParseResult;
      const score = scoreResult(parsed);

      // Modificar solo current, no bestRef entero
      if (!bestRef.current || score > bestRef.current.score) {
        bestRef.current = { result: parsed, lines, score };
      }
    } catch {
      // formato no reconocido → ignorar
    }
  };

  for (let i = 0; i <= candidates.length - 3; i++) {
    tryParse([fitLine(candidates[i], 30), fitLine(candidates[i + 1], 30), fitLine(candidates[i + 2], 30)]);
  }
  for (let i = 0; i <= candidates.length - 2; i++) {
    tryParse([fitLine(candidates[i], 44), fitLine(candidates[i + 1], 44)]);
  }
  for (const line of candidates) {
    if (line.length >= 88) tryParse([fitLine(line.slice(0, 44), 44), fitLine(line.slice(44, 88), 44)]);
    if (line.length >= 90) tryParse([fitLine(line.slice(0, 30), 30), fitLine(line.slice(30, 60), 30), fitLine(line.slice(60, 90), 30)]);
  }

  return bestRef.current;
}

// ─── Mapeo → PartialGuestData ─────────────────────────────────────────────────

function mrzToGuestData(parsed: ParseResult, rawLines: string[]): Partial<PartialGuestData> {
  // fields es FieldRecords = Partial<Record<FieldName, string|null>>
  // Accedemos como Record para simplificar sin perder seguridad
  const f = parsed.fields as Record<string, string | null>;
  const out: Partial<PartialGuestData> = {};

  // Nombre: parsear línea cruda para preservar separadores «<»
  const nameLine = parsed.format === 'TD3' ? (rawLines[0] ?? '').slice(5) : (rawLines[2] ?? '');
  if (nameLine) {
    const { nombre, apellido, apellido2 } = parseNameLine(nameLine);
    if (nombre)    out.nombre    = nombre;
    if (apellido)  out.apellido  = apellido;
    if (apellido2) out.apellido2 = apellido2;
  } else {
    if (f.firstName) out.nombre   = f.firstName.split(' ').map(cap).join(' ');
    if (f.lastName)  {
      const parts = f.lastName.split(' ');
      out.apellido  = cap(parts[0] ?? '');
      out.apellido2 = parts.slice(1).map(cap).join(' ');
    }
  }

  const fecha = parseDate(f.birthDate);
  if (fecha) out.fechaNac = fecha;

  out.sexo = parseSex(f.sex);

  const nat = (f.nationality ?? f.issuingState ?? '').toUpperCase().replace(/<+/g, '');
  out.nacionalidad = NAT[nat] ?? 'Otra';

  if (parsed.format === 'TD1') {
    const soporte = (f.documentNumber ?? '').replace(/<+$/g, '').trim();
    const dniRaw  = (f.optional1 ?? '').slice(0, 9).replace(/<+$/g, '').trim();
    const isDNI   = (s: string) => /^\d{8}[A-Z]$/.test(s);
    const isNIE   = (s: string) => /^[XYZ]\d{7}[A-Z]$/.test(s);
    if      (isDNI(dniRaw))   { out.tipoDoc = 'DNI'; out.numDoc = dniRaw;   if (soporte.length >= 8) out.soporteDoc = soporte; }
    else if (isNIE(dniRaw))   { out.tipoDoc = 'NIE'; out.numDoc = dniRaw;   if (soporte.length >= 8) out.soporteDoc = soporte; }
    else if (isDNI(soporte))  { out.tipoDoc = 'DNI'; out.numDoc = soporte; }
    else if (isNIE(soporte))  { out.tipoDoc = 'NIE'; out.numDoc = soporte; }
    else {
      out.tipoDoc = nat === 'ESP' ? 'DNI' : 'NIE';
      out.numDoc  = dniRaw || soporte;
      if (soporte && soporte !== out.numDoc && soporte.length >= 8) out.soporteDoc = soporte;
    }
  } else if (parsed.format === 'TD3') {
    const passNum = (f.documentNumber ?? '').replace(/<+$/g, '').trim();
    if (passNum) { out.tipoDoc = 'Pasaporte'; out.numDoc = passNum; }
  }

  return out;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDocumentOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress]         = useState<OCRProgress>({ fase: '', pct: 0 });
  const workerRef                       = useRef<TWorker | null>(null);

  const setFase = useCallback((fase: string, pct: number) =>
    setProgress({ fase, pct: Math.round(pct) }), []);

  const getWorker = useCallback(async (): Promise<TWorker> => {
    if (workerRef.current) return workerRef.current;
    setFase('Cargando motor OCR…', 5);
    const w = await createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text')
          setProgress(prev => ({ fase: prev.fase, pct: Math.round(30 + m.progress * 35) }));
      },
    });
    workerRef.current = w;
    return w;
  }, [setFase]);

 const processDocument = useCallback(async (file: File): Promise<OCRResult> => {
    setIsProcessing(true);
    setProgress({ fase: 'Preparando imagen…', pct: 2 });

    try {
      setFase('Mejorando calidad de imagen…', 8);
      let images: PrepImages;
      try {
        images = await prepareImages(file);
      } catch (err) {
        console.error('[OCR] prepareImages:', err);
        return { ok: false, error: 'No se pudo leer la imagen. Use JPG o PNG (máx 20 MB).' };
      }

      setFase('Iniciando motor OCR…', 16);
      const worker = await getWorker();

      // 🚨 LA SOLUCIÓN: Usamos un contenedor para no perder el tipo en la closure asíncrona
      const bestRef: { current: MRZCandidate | null } = { current: null };

      const runPass = async (img: string, psm: PSM, fase: string, pct: number) => {
        // Accedemos a bestRef.current (TypeScript ya sabe que puede mutar)
        if (bestRef.current && bestRef.current.score >= 0.85) return;
        setFase(fase, pct);
        try {
          const lines = extractLines(await runOCR(worker, img, psm));
          const candidate: MRZCandidate | null = findbestRefMRZ(lines);

          if (candidate !== null) {
            if (!bestRef.current || candidate.score > bestRef.current.score) {
              bestRef.current = candidate; 
            }
          }
        } catch (e) {
          console.warn(`[OCR] Pasada "${fase}" fallida:`, e);
        }
      };

      await runPass(images.mrzNarrow,  PSM.SINGLE_BLOCK, 'Analizando zona MRZ…',     28);
      await runPass(images.mrzNarrowE, PSM.SINGLE_BLOCK, 'Segunda pasada MRZ…',      52);
      await runPass(images.mrzWide,    PSM.SINGLE_BLOCK, 'Pasada zona amplia…',        68);
      await runPass(images.full,       PSM.SPARSE_TEXT,  'Análisis imagen completa…',  82);

      setFase('Procesando datos…', 94);

      // Usamos .current para el chequeo final y el retorno de datos
      if (!bestRef.current) return {
        ok: false,
        error: 'No se detectó la zona MRZ. Fotografíe el REVERSO del DNI (las 3 líneas de letras y números en la parte inferior) o la página de datos del pasaporte. Use buena luz y sin reflejos.',
      };

      if (bestRef.current.score < 0.3) return {
        ok: false,
        formato:   bestRef.current.result.format,
        confianza: bestRef.current.score,
        error: 'Lectura poco fiable. Use mejor iluminación o rellene los datos manualmente.',
      };

      setFase('¡Lectura completada!', 100);
      return { 
        ok: true, 
        data: mrzToGuestData(bestRef.current.result, bestRef.current.lines), 
        formato: bestRef.current.result.format, 
        confianza: bestRef.current.score 
      };

    } catch (err) {
      console.error('[OCR] Error inesperado:', err);
      return { ok: false, error: 'Error inesperado. Inténtelo de nuevo.' };
    } finally {
      setIsProcessing(false);
    }
  }, [getWorker, setFase]);

  const terminate = useCallback(async () => {
    if (workerRef.current) { await workerRef.current.terminate(); workerRef.current = null; }
  }, []);

  return { processDocument, isProcessing, progress, terminate };
}