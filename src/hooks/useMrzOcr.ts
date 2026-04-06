// src/hooks/useMrzOcr.ts

import { useCallback, useRef, useState } from 'react';
import { createWorker, PSM, OEM } from 'tesseract.js';
import type { Worker } from 'tesseract.js';
import { preprocessForMrz, extractMrzRegions } from '@/hooks/imagePreprocess';
import { parseMrzLines } from '@/hooks/mrzParser';
import type { MrzResult } from '@/hooks/mrzParser';

export type { MrzResult };

export type OcrStatus =
  | 'idle'
  | 'loading_engine'
  | 'preprocessing'
  | 'recognizing'
  | 'done'
  | 'error';

export interface OcrState {
  status:              OcrStatus;
  progress:            number;
  statusText:          string;
  result:              MrzResult | null;
  error:               string | null;
  preprocessCanvasUrl: string | null;
}

// ── Singleton worker ──────────────────────────────────────────────────────────
let _worker:        Worker | null = null;
let _workerReady                  = false;
let _workerLoading: Promise<Worker> | null = null;
let _progressCb: ((p: number, msg: string) => void) | null = null;

// URL del modelo OCR-B específico para MRZ/documentos de identidad
// Este modelo está entrenado con la fuente OCR-B estándar ISO/IEC 1073-2
const OCRB_TRAINEDDATA_URL =
  'https://raw.githubusercontent.com/tesseract-ocr/tessdata/main/ocrb.traineddata';

async function getOrCreateWorker(): Promise<Worker> {
  if (_workerReady && _worker) return _worker;
  if (_workerLoading)          return _workerLoading;

  _workerLoading = createWorker('ocrb', OEM.LSTM_ONLY, {
    // Cargamos el modelo ocrb en lugar de 'eng'
    // OEM.LSTM_ONLY: solo red neuronal, más preciso y rápido que el legacy
    langPath: OCRB_TRAINEDDATA_URL.replace('/ocrb.traineddata', ''),
    // langPath apunta a la carpeta; tesseract.js añade /ocrb.traineddata automáticamente
    logger: (m: { status: string; progress: number }) => {
      if (!_progressCb) return;
      const pct = Math.round(m.progress * 100);
      if (m.status === 'loading tesseract core')       _progressCb(5,  'Cargando motor OCR...');
      if (m.status === 'initializing tesseract')       _progressCb(10, 'Iniciando motor...');
      if (m.status === 'loading language traineddata') _progressCb(10 + Math.round(pct * 0.15), 'Cargando modelo OCR-B...');
      if (m.status === 'initialized api')              _progressCb(28, 'Motor listo');
      if (m.status === 'recognizing text')             _progressCb(35 + Math.round(pct * 0.5), 'Reconociendo...');
    },
  }).then(async (w) => {
    await w.setParameters({
      // Whitelist estricta: solo los caracteres válidos en MRZ
      tessedit_char_whitelist:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      // RAW_LINE: sin detección de párrafos, sin word boxes — línea cruda
      // Este es el PSM correcto para MRZ procesada línea a línea
      tessedit_pageseg_mode:     PSM.RAW_LINE,
      // No invertir: nuestro preprocesado ya garantiza texto negro sobre blanco
      tessedit_do_invert:        '0',
      // Deshabilitar detección de orientación (ya corregida en preprocesado)
      hocr_font_info:            '0',
    });
    _worker      = w;
    _workerReady = true;
    return w;
  });

  return _workerLoading;
}

export function warmupMrzWorker(): void {
  getOrCreateWorker().catch(() => {
    _workerLoading = null;
    _workerReady   = false;
    _worker        = null;
  });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useMrzOcr() {
  const [state, setState] = useState<OcrState>({
    status: 'idle', progress: 0, statusText: '', result: null, error: null,
    preprocessCanvasUrl: null,
  });

  const cancelRef = useRef(false);

  const scan = useCallback(async (file: File): Promise<MrzResult | null> => {
    cancelRef.current = false;

    const update = (partial: Partial<OcrState>) =>
      setState(s => ({ ...s, ...partial }));

    update({
      status: 'loading_engine', progress: 2,
      statusText: 'Iniciando lector de documentos...',
      result: null, error: null, preprocessCanvasUrl: null,
    });

    _progressCb = (progress, statusText) => {
      if (!cancelRef.current) update({ progress, statusText });
    };

    try {
      const worker = await getOrCreateWorker();
      if (cancelRef.current) return null;

      // ── PASO 1: Preprocesar imagen completa ──────────────────────────────
      update({ status: 'preprocessing', progress: 29, statusText: 'Analizando imagen...' });
      const { fullCanvas, mrzCanvas } = await preprocessForMrz(file);
      if (cancelRef.current) return null;

      update({ preprocessCanvasUrl: mrzCanvas.toDataURL('image/png') });

      // ── PASO 2: Extraer líneas MRZ como canvases individuales ────────────
      update({ progress: 33, statusText: 'Detectando líneas MRZ...' });
      const lineCanvases = extractMrzRegions(mrzCanvas);
      if (cancelRef.current) return null;

      // ── PASO 3: OCR línea a línea con PSM.RAW_LINE ───────────────────────
      update({ status: 'recognizing', progress: 38, statusText: 'Leyendo líneas...' });

      const recognizedLines: string[] = [];
      const totalLines = lineCanvases.length;

      for (let i = 0; i < totalLines; i++) {
        if (cancelRef.current) return null;
        const pct = 38 + Math.round(((i + 1) / totalLines) * 45);
        update({ progress: pct, statusText: `Leyendo línea ${i + 1} de ${totalLines}...` });

        const { data } = await worker.recognize(lineCanvases[i]);
        const raw = data.text.trim();
        if (raw.length > 0) recognizedLines.push(raw);
      }

      // ── PASO 4: Si no hay suficientes líneas, reintentar con imagen completa
      if (recognizedLines.length < 2) {
        update({ progress: 84, statusText: 'Reintentando lectura completa...' });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
        const { data: fullData } = await worker.recognize(mrzCanvas);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });

        fullData.text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length >= 20)
          .forEach(l => recognizedLines.push(l));
      }

      if (cancelRef.current) return null;

      // ── PASO 5: Fallback con imagen completa si zona MRZ no funcionó ─────
      if (recognizedLines.length < 2) {
        update({ progress: 88, statusText: 'Último intento con imagen completa...' });
        await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        const { data: fullImageData } = await worker.recognize(fullCanvas);
        await worker.setParameters({ tessedit_pageseg_mode: PSM.RAW_LINE });

        fullImageData.text
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length >= 20)
          .forEach(l => recognizedLines.push(l));
      }

      update({ progress: 93, statusText: 'Interpretando datos...' });

      if (recognizedLines.length === 0) {
        throw new Error(
          'No se detectó zona MRZ. Fotografíe el documento completo con buena iluminación, en horizontal y sin reflejos.'
        );
      }

      const result = parseMrzLines(recognizedLines);

      if (!result.numDoc && !result.apellido) {
        throw new Error(
          'Imagen con poca calidad para leer el documento. Acérquese más, use buena iluminación y evite reflejos.'
        );
      }

      update({
        status: 'done', progress: 100,
        statusText: 'Lectura completada',
        result, error: null,
      });
      return result;

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Error desconocido';
      update({ status: 'error', progress: 0, statusText: '', result: null, error });
      return null;
    } finally {
      _progressCb = null;
    }
  }, []);

  const reset = useCallback(() => {
    cancelRef.current = true;
    setState({
      status: 'idle', progress: 0, statusText: '', result: null,
      error: null, preprocessCanvasUrl: null,
    });
  }, []);

  return { ...state, scan, reset };
}