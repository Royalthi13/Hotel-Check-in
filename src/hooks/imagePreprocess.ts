// src/hooks/imagePreprocess.ts

// ── Utilidades de pixel ───────────────────────────────────────────────────────

function toGrayscale(data: Uint8ClampedArray): void {
  for (let i = 0; i < data.length; i += 4) {
    // Luminosidad perceptual (BT.601)
    const g = Math.round(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
    data[i] = data[i + 1] = data[i + 2] = g;
  }
}

/**
 * Binarización adaptativa local (Sauvola simplificado).
 * Mucho mejor que Otsu global para fotos de documentos con iluminación irregular.
 * Para cada pixel, calcula el umbral basándose en su vecindario local.
 */
function adaptiveThreshold(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  windowSize = 41,   // Tamaño del vecindario (debe ser impar)
  k = 0.15,          // Sensibilidad (0.1-0.2 funciona bien para texto)
): void {
  const half = Math.floor(windowSize / 2);
  const copy = new Uint8ClampedArray(data);

  // Tabla integral para calcular medias rápido
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = copy[(y * width + x) * 4];
      integral[(y + 1) * (width + 1) + (x + 1)] =
        v
        + integral[y * (width + 1) + (x + 1)]
        + integral[(y + 1) * (width + 1) + x]
        - integral[y * (width + 1) + x];
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x1 = Math.max(0, x - half);
      const y1 = Math.max(0, y - half);
      const x2 = Math.min(width - 1, x + half);
      const y2 = Math.min(height - 1, y + half);
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);

      const sum =
        integral[(y2 + 1) * (width + 1) + (x2 + 1)]
        - integral[y1 * (width + 1) + (x2 + 1)]
        - integral[(y2 + 1) * (width + 1) + x1]
        + integral[y1 * (width + 1) + x1];

      const mean = sum / count;
      const pixel = copy[(y * width + x) * 4];
      // Sauvola: umbral = mean * (1 + k * (std/128 - 1))
      // Versión simplificada sin desviación estándar: threshold = mean * (1 - k)
      const threshold = mean * (1 - k);
      const v = pixel > threshold ? 255 : 0;
      const idx = (y * width + x) * 4;
      data[idx] = data[idx + 1] = data[idx + 2] = v;
    }
  }
}

/**
 * Sharpening (unsharp mask 3×3) para mejorar bordes de caracteres.
 */
function sharpen(data: Uint8ClampedArray, width: number, height: number): void {
  const copy = new Uint8ClampedArray(data);
  // Kernel laplaciano de realce de bordes
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += copy[((y + ky) * width + (x + kx)) * 4] * k[(ky + 1) * 3 + (kx + 1)];
        }
      }
      const idx = (y * width + x) * 4;
      const v = Math.max(0, Math.min(255, sum));
      data[idx] = data[idx + 1] = data[idx + 2] = v;
    }
  }
}

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen')); };
    img.src = url;
  });
}

// ── Función principal de preprocesado ─────────────────────────────────────────

export interface PreprocessResult {
  fullCanvas: HTMLCanvasElement; // Imagen completa procesada (fallback)
  mrzCanvas:  HTMLCanvasElement; // Solo la zona MRZ (uso principal)
}

/**
 * Preprocesa la imagen para maximizar la precisión de Tesseract OCRB:
 * 1. Redimensiona a ancho óptimo (1200px base, 3× upscale → ~3600px efectivos)
 * 2. Convierte a escala de grises
 * 3. Aplica sharpening
 * 4. Binarización adaptativa (Sauvola simplificado)
 * 5. Recorta la zona MRZ (30% inferior del área de datos)
 * 6. Añade padding blanco para que Tesseract no corte caracteres en bordes
 * 7. Devuelve tanto el canvas completo como el de la zona MRZ
 */
export async function preprocessForMrz(file: File): Promise<PreprocessResult> {
  const imgEl = await fileToImage(file);

  // Redimensionar a ancho base con ratio mantenido
  const BASE_WIDTH = 1200;
  let srcW = imgEl.naturalWidth;
  let srcH = imgEl.naturalHeight;
  if (srcW > BASE_WIDTH) {
    srcH = Math.round(srcH * BASE_WIDTH / srcW);
    srcW = BASE_WIDTH;
  }

  // Canvas base
  const base = document.createElement('canvas');
  base.width = srcW;
  base.height = srcH;
  const baseCtx = base.getContext('2d', { willReadFrequently: true })!;
  baseCtx.drawImage(imgEl, 0, 0, srcW, srcH);

  // Pipeline: gris → sharpen → binarización adaptativa
  const imageData = baseCtx.getImageData(0, 0, srcW, srcH);
  toGrayscale(imageData.data);
  sharpen(imageData.data, srcW, srcH);
  adaptiveThreshold(imageData.data, srcW, srcH);
  baseCtx.putImageData(imageData, 0, 0);

  // ── Canvas completo (upscale 3×) ─────────────────────────────────────────
  const SCALE = 3;
  const PAD   = 30; // padding blanco para que Tesseract no corte en bordes

  const fullCanvas = document.createElement('canvas');
  fullCanvas.width  = srcW * SCALE;
  fullCanvas.height = srcH * SCALE;
  const fullCtx = fullCanvas.getContext('2d')!;
  fullCtx.fillStyle = '#ffffff';
  fullCtx.fillRect(0, 0, fullCanvas.width, fullCanvas.height);
  fullCtx.imageSmoothingEnabled = false;
  fullCtx.drawImage(base, 0, 0, fullCanvas.width, fullCanvas.height);

  // ── Canvas zona MRZ (30% inferior, upscale 3×) ───────────────────────────
  // El 30% inferior cubre la MRZ en DNI español y pasaporte
  const mrzY = Math.floor(srcH * 0.70);
  const mrzH = srcH - mrzY;

  const mrzData = baseCtx.getImageData(0, mrzY, srcW, mrzH);

  // Canvas intermedio con zona MRZ a tamaño base
  const mrzBase = document.createElement('canvas');
  mrzBase.width = srcW;
  mrzBase.height = mrzH;
  mrzBase.getContext('2d')!.putImageData(mrzData, 0, 0);

  // Canvas final MRZ con padding y upscale
  const mrzCanvas = document.createElement('canvas');
  mrzCanvas.width  = srcW * SCALE + PAD * 2;
  mrzCanvas.height = mrzH * SCALE + PAD * 2;
  const mrzCtx = mrzCanvas.getContext('2d')!;
  mrzCtx.fillStyle = '#ffffff';
  mrzCtx.fillRect(0, 0, mrzCanvas.width, mrzCanvas.height);
  mrzCtx.imageSmoothingEnabled = false;
  mrzCtx.drawImage(mrzBase, PAD, PAD, srcW * SCALE, mrzH * SCALE);

  return { fullCanvas, mrzCanvas };
}

// ── Extracción de líneas MRZ ──────────────────────────────────────────────────

/**
 * Divide el canvas de la zona MRZ en canvases individuales, uno por línea.
 *
 * Algoritmo: proyección horizontal de píxeles negros.
 * Las líneas de texto generan picos en el histograma de densidad vertical.
 * Los valles entre picos son los separadores de líneas.
 *
 * Para un DNI español (TD1): detecta 3 bandas.
 * Para un pasaporte (TD3): detecta 2 bandas.
 */
export function extractMrzRegions(mrzCanvas: HTMLCanvasElement): HTMLCanvasElement[] {
  const ctx = mrzCanvas.getContext('2d', { willReadFrequently: true })!;
  const { width, height } = mrzCanvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data }  = imageData;

  // Histograma de densidad: por cada fila, contar píxeles negros (valor 0)
  const rowDensity = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let black = 0;
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] < 128) black++;
    }
    rowDensity[y] = black / width;
  }

  // Suavizar el histograma (media móvil 5px) para eliminar ruido
  const smooth = new Float32Array(height);
  for (let y = 0; y < height; y++) {
    let s = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) {
      const yy = y + dy;
      if (yy >= 0 && yy < height) { s += rowDensity[yy]; c++; }
    }
    smooth[y] = s / c;
  }

  // Encontrar bandas de texto: grupos de filas con densidad > umbral
  const DENSITY_THRESHOLD = 0.02; // Al menos 2% de píxeles negros → es texto
  const MIN_BAND_HEIGHT   = Math.floor(height * 0.05); // Mínimo 5% de altura total

  const bands: Array<{ y1: number; y2: number }> = [];
  let inBand = false;
  let bandStart = 0;

  for (let y = 0; y < height; y++) {
    if (!inBand && smooth[y] > DENSITY_THRESHOLD) {
      inBand    = true;
      bandStart = y;
    } else if (inBand && smooth[y] <= DENSITY_THRESHOLD) {
      inBand = false;
      const bandH = y - bandStart;
      if (bandH >= MIN_BAND_HEIGHT) {
        bands.push({ y1: bandStart, y2: y });
      }
    }
  }
  // Cerrar banda si llega al final
  if (inBand && height - bandStart >= MIN_BAND_HEIGHT) {
    bands.push({ y1: bandStart, y2: height });
  }

  // Si no detectamos bandas claras, devolver el canvas completo como una sola "línea"
  if (bands.length === 0) return [mrzCanvas];

  // Convertir cada banda en un canvas con padding
  const LINE_PAD = 8;
  return bands.map(({ y1, y2 }) => {
    const lineCanvas = document.createElement('canvas');
    lineCanvas.width  = width;
    lineCanvas.height = (y2 - y1) + LINE_PAD * 2;
    const lctx = lineCanvas.getContext('2d')!;
    lctx.fillStyle = '#ffffff';
    lctx.fillRect(0, 0, lineCanvas.width, lineCanvas.height);
    lctx.drawImage(mrzCanvas, 0, y1, width, y2 - y1, 0, LINE_PAD, width, y2 - y1);
    return lineCanvas;
  });
}