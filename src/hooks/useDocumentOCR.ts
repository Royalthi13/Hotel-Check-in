import { useState, useRef, useCallback } from "react";
import { createWorker, PSM } from "tesseract.js";
import { useTranslation } from "react-i18next";
import {
  decode as ijsDecode,
  encodeDataURL as ijsEncodeDataURL,
} from "image-js";
import { parse as mrzParse } from "mrz";
import type { ParseResult } from "mrz";
import type { PartialGuestData } from "@/types";
import { normalizeOcrCity } from "@/api/city-normalization.service";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export interface OCRProgress {
  fase: string;
  pct: number;
}

export interface OCRResult {
  ok: boolean;
  data?: Partial<PartialGuestData>;
  formato?: string | null;
  confianza?: number;
  error?: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const WHITELIST = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<";
const MIN_SCORE = 0.28;
const GOOD_SCORE = 0.72;
const MRZ_TARGET_W = 2200;
const MAX_INPUT_W = 2400;

const NAT: Record<string, string> = {
  ESP: "Española",
  GBR: "Inglesa",
  FRA: "Francesa",
  DEU: "Alemana",
  ITA: "Italiana",
  PRT: "Portuguesa",
  USA: "Estadounidense",
  ARG: "Argentina",
  MEX: "Mexicana",
  BRA: "Otra",
  CHN: "Otra",
  JPN: "Otra",
  KOR: "Otra",
  IND: "Otra",
  AUS: "Otra",
  MAR: "Otra",
  SEN: "Otra",
  COL: "Otra",
  PER: "Otra",
  VEN: "Otra",
};

// ─── Corrección EXIF ──────────────────────────────────────────────────────────

async function loadExifCorrectedBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;

        const originalWidth = img.naturalWidth;
        const originalHeight = img.naturalHeight;

        // 🎯 1. DEFINIMOS EL RECTÁNGULO DNI (Relación 3:2)
        // El DNI es más ancho que alto. 1.5 es el ratio ideal (3/2).
        const targetRatio = 1.5;
        let cropWidth, cropHeight;

        // Calculamos el recorte centrado según la foto original
        if (originalWidth / originalHeight > targetRatio) {
          // La foto es muy ancha (ej. 16:9), recortamos los lados
          cropHeight = originalHeight;
          cropWidth = originalHeight * targetRatio;
        } else {
          // La foto es muy alta (ej. 4:3 en vertical), recortamos arriba y abajo
          cropWidth = originalWidth;
          cropHeight = originalWidth / targetRatio;
        }

        // 2. CENTRAMOS EL RECORTE
        const startX = (originalWidth - cropWidth) / 2;
        const startY = (originalHeight - cropHeight) / 2;

        // 3. AJUSTAMOS EL LIENZO AL TAMAÑO DEL RECORTE
        canvas.width = cropWidth;
        canvas.height = cropHeight;

        // 4. DIBUJAMOS SOLO EL RECTÁNGULO CENTRAL
        ctx.drawImage(
          img,
          startX,
          startY,
          cropWidth,
          cropHeight, // De dónde cortamos (original)
          0,
          0,
          cropWidth,
          cropHeight, // Dónde lo ponemos (canvas)
        );

        URL.revokeObjectURL(url);

        // Exportamos como PNG de alta calidad
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Error al crear el Blob"))),
          "image/png",
          0.95,
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("Error al cargar la imagen"));
    img.src = url;
  });
}

// ─── Limpieza de Strings (Universal) ──────────────────────────────────────────

function filterOcrGarbage(raw: string): string {
  if (!raw) return "";

  let textoLimpio = raw
    .toUpperCase()
    .replace(/<K/g, " ")
    .replace(/K</g, " ")
    .replace(/<+/g, " ")
    .trim();

  textoLimpio = textoLimpio
    .split(/\s+/)
    .map((word) => {
      if (!word || /^[KXZL]+$/i.test(word)) return "";
      return word.replace(
        /([A-ZÁÉÍÓÚÑ])([KXZL]+)$/i,
        (_match, prevChar, garbage) => {
          const g = garbage.toUpperCase();
          if (g === "LL") return prevChar + "LL";
          if (g === "Z" || g === "ZZ") return prevChar + "Z";
          if (g === "X" && /[AEIOU]/i.test(prevChar)) return prevChar + "X";
          if (g.startsWith("L") && /[EIUÉÍÚ]/i.test(prevChar))
            return prevChar + "L";
          return prevChar;
        },
      );
    })
    .join(" ");

  return textoLimpio
    .split(/\s+/)
    .filter((word) => {
      if (!word || word.length < 2)
        return ["y", "e", "de", "la", "el"].includes(word.toLowerCase());
      return (
        (word.match(/[AEIOUaeiouÁÉÍÓÚáéíóú]/g) || []).length > 0 ||
        word.length <= 2
      );
    })
    .map((w) =>
      w
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ""))
        .join("-"),
    )
    .join(" ")
    .trim();
}

function titleCase(s: string): string {
  if (!s) return "";
  const preps = new Set([
    "de",
    "del",
    "la",
    "las",
    "los",
    "el",
    "en",
    "y",
    "a",
    "al",
  ]);
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return "";
      if (i > 0 && preps.has(w)) return w;
      return w
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
        .join("-");
    })
    .join(" ");
}

function parseDate(yymmdd: string | null | undefined): string {
  if (!yymmdd || !/^\d{6}$/.test(yymmdd)) return "";
  const yy = parseInt(yymmdd.slice(0, 2), 10);
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  if (+mm < 1 || +mm > 12 || +dd < 1 || +dd > 31) return "";
  const currentYear = new Date().getFullYear();
  let fullYear = 2000 + yy;
  if (fullYear > currentYear) fullYear = 1900 + yy;
  return `${fullYear}-${mm}-${dd}`;
}

function parseSex(s: string | null | undefined): string {
  if (s === "male") return "Hombre";
  if (s === "female") return "Mujer";
  return "No indicar";
}

// ─── Lógica MRZ (DNI 4.0 Ready) ───────────────────────────────────────────────

function scoreResult(p: ParseResult): number {
  const rel = p.details.filter((d) => d.field !== null);
  return rel.length === 0 ? 0 : rel.filter((d) => d.valid).length / rel.length;
}

function fitLine(line: string, len: number) {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, "<");
}

function cleanLine(raw: string) {
  let cleaned = raw.toUpperCase().replace(/\s+/g, "");
  cleaned = cleaned.replace(/([A-Z])K([A-Z])/g, "$1<<$2");
  cleaned = cleaned.replace(/<K/g, "<<").replace(/K</g, "<<");
  cleaned = cleaned.replace(/<Z</g, "<<<").replace(/<Z</g, "<<<");
  cleaned = cleaned.replace(/<Z$/g, "<<");
  return cleaned
    .split("")
    .map((c) => (WHITELIST.includes(c) ? c : "<"))
    .join("");
}

function extractCandidates(text: string) {
  return text
    .split("\n")
    .map(cleanLine)
    .filter(
      (l) => l.length >= 22 && l.replace(/</g, "").length / l.length >= 0.18,
    );
}

interface MRZCandidate {
  result: ParseResult;
  score: number;
  inputLines: string[];
}

function findBestMRZ(lines: string[]): MRZCandidate | null {
  let best: MRZCandidate | null = null;
  const tryParse = (ls: string[]) => {
    try {
      const result = mrzParse(ls, { autocorrect: true }) as ParseResult;
      const score = scoreResult(result);
      if (!best || score > best.score) best = { result, score, inputLines: ls };
    } catch {
      /* ignorar */
    }
  };

  for (let i = 0; i <= lines.length - 2; i++)
    tryParse([fitLine(lines[i], 44), fitLine(lines[i + 1], 44)]);
  for (let i = 0; i <= lines.length - 3; i++)
    tryParse([
      fitLine(lines[i], 30),
      fitLine(lines[i + 1], 30),
      fitLine(lines[i + 2], 30),
    ]);
  for (let i = 0; i <= lines.length - 2; i++)
    tryParse([
      fitLine(lines[i], 30),
      fitLine(lines[i + 1], 30),
      "".padEnd(30, "<"),
    ]);
  for (const line of lines) {
    if (line.length >= 88)
      tryParse([
        fitLine(line.slice(0, 44), 44),
        fitLine(line.slice(44, 88), 44),
      ]);
    if (line.length >= 90)
      tryParse([
        fitLine(line.slice(0, 30), 30),
        fitLine(line.slice(30, 60), 30),
        fitLine(line.slice(60, 90), 30),
      ]);
  }
  return best;
}

function mrzToGuest(parsed: ParseResult): Partial<PartialGuestData> {
  const f = parsed.fields as Record<string, string | null>;
  const out: Partial<PartialGuestData> = {};
  const isSpanish =
    f.issuingState?.includes("ESP") || f.nationality?.includes("ESP");

  const rawLast = (f.lastName ?? "").trim();
  const rawFirst = (f.firstName ?? "").trim();
  const allWords = `${rawLast} ${rawFirst}`.split(/\s+/).filter(Boolean);
  if (allWords.length > 0) {
    // FIX: Cambiamos 'let ap1' por 'const ap1' y separamos las variables
    const ap1 = allWords[0];
    let ap2 = "";
    let nom = "";

    const particles = ["DE", "DEL", "LA", "LAS", "LOS"];
    if (isSpanish) {
      if (
        allWords.length >= 4 &&
        particles.includes(allWords[1].toUpperCase())
      ) {
        ap2 = `${allWords[1]} ${allWords[2]}`;
        nom = allWords.slice(3).join(" ");
      } else if (allWords.length >= 3) {
        ap2 = allWords[1];
        nom = allWords.slice(2).join(" ");
      } else {
        nom = allWords.slice(1).join(" ");
      }
    } else {
      nom = allWords.slice(1).join(" ");
    }
    out.apellido = filterOcrGarbage(ap1);
    out.apellido2 = filterOcrGarbage(ap2);
    out.nombre = filterOcrGarbage(nom);
  }

  const fecha = parseDate(f.birthDate);
  if (fecha) out.fechaNac = fecha;
  out.sexo = parseSex(f.sex);

  const natCode = (f.nationality ?? f.issuingState ?? "")
    .toUpperCase()
    .replace(/<+/g, "");
  out.nacionalidad = NAT[natCode] ?? "Otra";
  if (natCode === "ESP") out.pais = "ES";

  if (parsed.format === "TD1") {
    const soporte = (f.documentNumber ?? "").replace(/<+$/g, "").trim();
    const optionalFull = (f.optional1 ?? "").replace(/<+/g, " ").trim();

    // Extractor infalible para DNI 4.0 que detecta el patrón DNI/NIE en cualquier posición
    const dniNieRegex = /([0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])/i;
    const match = optionalFull.match(dniNieRegex);

    if (match) {
      out.numDoc = match[1].toUpperCase();
      out.tipoDoc = /^[XYZ]/i.test(match[1]) ? "NIE" : "DNI";
      out.soporteDoc = soporte;
    } else {
      let cleaned = optionalFull.replace(/\s+/g, "");
      if (cleaned.length > 9 && /^[0-9]/.test(cleaned))
        cleaned = cleaned.substring(1);
      out.numDoc = cleaned.substring(0, 9);
      out.soporteDoc = soporte;
      out.tipoDoc = natCode === "ESP" ? "DNI" : "Otro";
    }
  } else if (parsed.format === "TD3") {
    const passNum = (f.documentNumber ?? "").replace(/<+$/g, "").trim();
    if (passNum) {
      out.tipoDoc = "Pasaporte";
      out.numDoc = passNum;
    }
  }

  return out;
}

// ─── Lógica del Domicilio (DNI 3.0 y 4.0 Ready) ───────────────────────────────

function parseDniBackAddress(text: string): Partial<PartialGuestData> {
  const out: Partial<PartialGuestData> = {
    direccion: "",
    ciudad: "",
    cp: "",
    provincia: "",
  };

  console.log("=== 1. OCR RAW (Lo que lee) ===", text);
  if (!text) return out;

  let clean = text
    .toUpperCase()
    .replace(/[\n\r]/g, " ")
    .replace(/[/\\_|]/g, " ")
    // FIX: Eliminada la barra de escape innecesaria en el guión (-)
    .replace(/[^A-Z0-9ÑÁÉÍÓÚÜºª., -]/g, " ");

  // 🛑 1. CORTAFUEGOS MEJORADO (Hijo, Nacimiento, ESP)
  let cutIndex = clean.length;
  const stopMatch = clean.match(
    /\b(HIJO|HIJA|HIJ0|H1JO|NACI|NACIMIENT[O0]?|ESP|ESPAÑA|ESPANA)\b/,
  );
  if (stopMatch && stopMatch.index !== undefined) {
    cutIndex = stopMatch.index;
  }
  if (cutIndex < clean.length) {
    clean = clean.substring(0, cutIndex);
  }

  // 🎯 2. FRANCOTIRADOR (Calle)
  const streetStartRegex =
    /(?:^|\s)(C\.|C\s|C\/|CALLE|AV\.|AV\s|AVENIDA|PZ\.|PZ\s|PLAZA)\s/i;
  const matchStart = clean.match(streetStartRegex);
  if (matchStart && matchStart.index !== undefined) {
    clean = clean.substring(matchStart.index).trim();
  }

  // 🧹 3. GOMA DE BORRAR IMPLACABLE (Con Pase VIP para Calles)
  clean = clean
    .split(/\s+/)
    .filter((w) => {
      // 🎟️ PASE VIP: Salvamos números, C, S, N, Y, y prefijos de calle (C., AV, PZ)
      if (/^[CSNY0-9]$/.test(w) || /^(C\.|C\/|AV\.|AV|PZ\.|PZ)$/.test(w))
        return true;

      // Si tiene 2 letras o menos, y NO es un conector, a la basura
      if (
        w.length <= 2 &&
        !["DE", "LA", "EL", "EN", "Y"].includes(w) &&
        !/\d/.test(w)
      )
        return false;
      if (/^\d{4,}$/.test(w) && !/^(0[1-9]|[1-4]\d|5[0-2])\d{3}$/.test(w))
        return false;
      if (/^([A-Z])\1+$/.test(w)) return false;
      // Las consonantes sueltas (XT, DG) se borran, EXCEPTO los prefijos VIP
      if (
        /^[A-Z]+$/.test(w) &&
        !/[AEIOU]/.test(w) &&
        !/^(C\.|C\/|AV\.|PZ\.)$/.test(w)
      )
        return false;

      return true;
    })
    .join(" ");

  clean = clean
    .replace(/\b(DOMICILIO|LUGAR|PROVINCIA|MUNICIPIO|EQUIPO|VALIDEZ)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 🪓 4. EL PIVOTE (Separador)
  const words = clean.split(/\s+/);
  let pivotIndex = -1;
  const pivotRegex = /^(\d{1,4}[A-Zºª]?|S\/N|S\d|B\d|Z\d|l\d|I\d)$/i;

  for (let i = 1; i < Math.min(words.length, 9); i++) {
    if (pivotRegex.test(words[i])) {
      pivotIndex = i;
      break;
    }
  }

  // 🏛️ 5. ASIGNACIÓN FINAL Y LIMPIEZA DE CIUDAD
  if (pivotIndex !== -1) {
    // FIX: Cambiados 'let' por 'const' al no ser reasignados
    const rawStreet = words.slice(0, pivotIndex).join(" ");
    const rawNumber = words[pivotIndex];

    const translateMap: Record<string, string> = {
      S: "5",
      B: "8",
      O: "0",
      Z: "2",
      l: "1",
      I: "1",
    };
    // FIX: Cambiado 'let' por 'const'
    const cleanNumber = rawNumber.replace(
      /[SBOZlI]/g,
      (m) => translateMap[m] || m,
    );

    out.direccion = titleCase(`${rawStreet} ${cleanNumber}`);

    let cityWords = words.slice(pivotIndex + 1).filter((w) => !/\d/.test(w));

    if (cityWords.length > 5) {
      cityWords = cityWords.slice(0, 5);
    }

    // FIX: Cambiado 'let' por 'const'
    const rawCity = cityWords.join(" ");
    if (rawCity) out.ciudad = rawCity;
  } else {
    out.direccion = titleCase(clean);
  }

  console.log("📍 Dirección final aislada:", out.direccion || "(vacía)");
  console.log("🏙️ Ciudad final aislada:", out.ciudad || "(vacía)");

  return out;
}

// ─── Procesado image-js (Motor MRZ original restaurado) ───────────────────────

interface PrepVariant {
  dataURL: string;
  psm: PSM;
  label: string;
}

async function buildMrzVariants(exifBlob: Blob): Promise<{
  variants: PrepVariant[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grey: any;
  width: number;
  height: number;
}> {
  const ab = await exifBlob.arrayBuffer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orig = ijsDecode(new Uint8Array(ab)) as any;

  let { width, height } = orig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let grey: any = orig.grey ? orig.grey() : orig;

  if (width > MAX_INPUT_W) {
    grey = grey.resize({ width: MAX_INPUT_W });
    height = Math.round((height * MAX_INPUT_W) / width);
    width = MAX_INPUT_W;
  }

  const mrzW = Math.max(MRZ_TARGET_W, Math.round(width * 2.8));
  const fullW = Math.max(1600, width);
  const variants: PrepVariant[] = [];

  const zones = [
    { label: "b50", yFrac: 0.5 },
    { label: "b30", yFrac: 0.7 },
    { label: "b38", yFrac: 0.62 },
    { label: "b24", yFrac: 0.76 },
  ];
  const levels = [
    { label: "std", inputMin: 20, inputMax: 230 },
    { label: "hico", inputMin: 55, inputMax: 200 },
    { label: "dark", inputMin: 0, inputMax: 175 },
  ];

  for (const z of zones) {
    const y = Math.floor(height * z.yFrac);
    const h = height - y;
    const crop = grey.crop({ x: 0, y: y, width, height: h });

    for (const lv of levels) {
      if (lv.label === "dark" && z.label !== "b24") continue;
      try {
        variants.push({
          dataURL: ijsEncodeDataURL(
            crop
              .level({ inputMin: lv.inputMin, inputMax: lv.inputMax })
              .resize({ width: mrzW }),
          ),
          psm: PSM.SINGLE_BLOCK,
          label: `${z.label}-${lv.label}`,
        });
      } catch {
        /* */
      }
    }
  }

  try {
    variants.push({
      dataURL: ijsEncodeDataURL(
        grey.level({ inputMin: 20, inputMax: 230 }).resize({ width: fullW }),
      ),
      psm: PSM.SPARSE_TEXT,
      label: "full",
    });
  } catch {
    /* */
  }

  return { variants, grey, width, height };
}

// ─── Procesado de Imagen (Para el Domicilio) ──────────────────────────────────

async function buildAddressVariantNative(fileOrBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = 2.5;
      canvas.width = img.width * scale;
      const cropHeight = img.height * 0.6;
      canvas.height = cropHeight * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.filter = "grayscale(100%) contrast(130%) brightness(110%)";
      ctx.drawImage(
        img,
        0,
        0,
        img.width,
        cropHeight,
        0,
        0,
        canvas.width,
        canvas.height,
      );
      resolve(canvas.toDataURL("image/jpeg", 0.95));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(fileOrBlob);
  });
}

// ─── Tesseract Worker ─────────────────────────────────────────────────────────

type TWorker = Awaited<ReturnType<typeof createWorker>>;
let _worker: TWorker | null = null;
let _ready = false;
let _loading: Promise<TWorker> | null = null;
let _terminating = false;

async function getWorker(onLoad?: (pct: number) => void): Promise<TWorker> {
  if (_ready && _worker) return _worker;
  if (_loading) return _loading;
  _terminating = false;
  _loading = createWorker(["eng", "spa"], 1, {
    logger: (m: { status: string; progress: number }) => {
      if (onLoad && m.status === "loading language traineddata")
        onLoad(Math.round(12 + m.progress * 14));
    },
  }).then((w) => {
    _worker = w;
    _ready = true;
    return w;
  });
  return _loading;
}

async function runMrzOCR(
  worker: TWorker,
  dataURL: string,
  psm: PSM,
): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (worker as any).setParameters({
    tessedit_char_whitelist: WHITELIST,
    tessedit_pageseg_mode: String(psm),
    load_system_dawg: "0",
    load_freq_dawg: "0",
    load_number_dawg: "0",
    tessedit_do_invert: "0",
    hocr_font_info: "0",
    textord_tabfind_find_tables: "0",
  });
  const { data } = await worker.recognize(dataURL);
  return data.text;
}

async function runTextOCR(worker: TWorker, dataURL: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (worker as any).setParameters({
    tessedit_char_whitelist:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑ0123456789 .,ºª/-\n",
    tessedit_pageseg_mode: "6",
    load_system_dawg: "0",
    load_freq_dawg: "0",
    load_punc_dawg: "0",
    load_unambig_dawg: "0",
  });

  const { data } = await worker.recognize(dataURL);
  return data.text;
}

// ─── Hook Exportado ───────────────────────────────────────────────────────────

export function useDocumentOCR() {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OCRProgress>({ fase: "", pct: 0 });
  const cancelRef = useRef(false);

  const setFase = useCallback((fase: string, pct: number) => {
    if (!cancelRef.current) setProgress({ fase, pct: Math.round(pct) });
  }, []);

  const terminate = useCallback(async () => {
    cancelRef.current = true;
    _terminating = true;
    if (_loading) {
      try {
        await _loading;
      } catch {
        /* */
      }
    }
    if (_worker) {
      try {
        await _worker.terminate();
      } catch {
        /* */
      }
      _worker = null;
      _ready = false;
      _loading = null;
    }
    _terminating = false;
  }, []);

  const processDocument = useCallback(
    async (file: File): Promise<OCRResult> => {
      cancelRef.current = false;
      setIsProcessing(true);
      setFase(t("ocr.prep_image"), 3);

      try {
        let exifBlob: Blob;
        try {
          setFase(t("ocr.fix_orientation"), 8);
          exifBlob = await loadExifCorrectedBlob(file);
          // FIX: Eliminada la captura de variable 'err' sin usar
        } catch {
          return { ok: false, error: t("ocr.err_format") };
        }

        let mrzVariants: PrepVariant[];
        try {
          setFase(t("ocr.analyzing"), 13);
          const built = await buildMrzVariants(exifBlob);
          mrzVariants = built.variants;
          // FIX: Eliminada la extracción de grey, width y height que luego no se usaban en ninguna parte del hook.
          // FIX: Eliminada la captura de variable 'err' sin usar
        } catch {
          return { ok: false, error: t("ocr.err_size") };
        }

        if (cancelRef.current || _terminating) return { ok: false };

        setFase(t("ocr.init_engine"), 20);
        const worker = await getWorker((pct) =>
          setFase(t("ocr.loading_model"), pct),
        );

        if (cancelRef.current || _terminating) return { ok: false };

        let best: MRZCandidate | null = null;
        const total = mrzVariants.length;

        for (let i = 0; i < total; i++) {
          if (cancelRef.current || _terminating) break;
          const pct = 25 + Math.round((i / total) * 50);

          let faseMsg = "";
          if (i === 0) faseMsg = t("ocr.reading_mrz");
          else if (i < total - 1)
            faseMsg = t("ocr.refining_mrz", {
              current: i + 1,
              total: total - 1,
            });
          else faseMsg = t("ocr.full_analysis");

          setFase(faseMsg, pct);

          try {
            const text = await runMrzOCR(
              worker,
              mrzVariants[i].dataURL,
              mrzVariants[i].psm,
            );
            const cands = extractCandidates(text);
            const cand = findBestMRZ(cands);
            if (cand && (!best || cand.score > best.score)) best = cand;
            // FIX: Eliminada la captura de variable 'err' sin usar
          } catch {
            /* */
          }

          if (best && best.score >= GOOD_SCORE) break;
        }

        if (cancelRef.current || _terminating) return { ok: false };
        if (!best) return { ok: false, error: t("ocr.err_not_found") };
        if (best.score < MIN_SCORE) {
          return {
            ok: false,
            formato: best.result.format,
            confianza: best.score,
            error: t("ocr.err_quality"),
          };
        }

        setFase(t("ocr.reading_address"), 78);
        const mrzData = mrzToGuest(best.result);
        let addressData: Partial<PartialGuestData> = {};

        if (best.result.format !== "TD3") {
          try {
            const addrDataURL = await buildAddressVariantNative(file);

            if (addrDataURL) {
              const addrText = await runTextOCR(worker, addrDataURL);
              addressData = parseDniBackAddress(addrText);

              if (addressData.ciudad) {
                const validated = await normalizeOcrCity(addressData.ciudad);
                if (validated) {
                  addressData.ciudad = validated.name;
                  addressData.cp = validated.cp;
                  addressData.provincia = validated.provincia;
                }
              }
            }
          } catch (err) {
            console.warn("[OCR] Error procesando el domicilio:", err);
          }
        }

        if (cancelRef.current || _terminating) return { ok: false };

        setFase(t("ocr.success"), 100);

        return {
          ok: true,
          data: { ...addressData, ...mrzData },
          formato: best.result.format,
          confianza: best.score,
        };
      } catch (err) {
        console.error("[useDocumentOCR]", err);
        return { ok: false, error: t("ocr.err_unexpected") };
      } finally {
        setIsProcessing(false);
      }
    },
    [setFase, t],
  );

  return { processDocument, isProcessing, progress, terminate };
}
