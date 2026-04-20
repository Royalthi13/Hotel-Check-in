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

// ─── EXIF correction via canvas ───────────────────────────────────────────────

async function loadExifCorrectedBlob(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob"))),
          "image/png",
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load failed"));
    };
    img.src = url;
  });
}

// SUSTITUYE TU filterOcrGarbage ENTERA POR ESTA:
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

// SUSTITUYE TU titleCase ENTERA POR ESTA:
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

  if (fullYear > currentYear) {
    fullYear = 1900 + yy;
  }
  return `${fullYear}-${mm}-${dd}`;
}

function parseSex(s: string | null | undefined): string {
  if (s === "male") return "Hombre";
  if (s === "female") return "Mujer";
  return "No indicar";
}

// ─── Scoring MRZ ─────────────────────────────────────────────────────────────

function scoreResult(p: ParseResult): number {
  const rel = p.details.filter((d) => d.field !== null);
  return rel.length === 0 ? 0 : rel.filter((d) => d.valid).length / rel.length;
}

function fitLine(line: string, len: number) {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, "<");
}

function cleanLine(raw: string) {
  // 1. Mayúsculas y quitamos espacios que inventa el HD
  let cleaned = raw.toUpperCase().replace(/\s+/g, "");

  // 2. Si hay una K entre dos letras, es un separador <
  cleaned = cleaned.replace(/([A-Z])K([A-Z])/g, "$1<<$2");

  // 3. Limpieza de basura estándar
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

// ─── Mejor combinación de líneas ─────────────────────────────────────────────

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
      /*  */
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

// ─── Mapear MRZ → formulario ──────────────────────────────────────────────────
function mrzToGuest(parsed: ParseResult): Partial<PartialGuestData> {
  const f = parsed.fields as Record<string, string | null>;
  const out: Partial<PartialGuestData> = {};

  const rawLast = (f.lastName ?? "").trim();
  const rawFirst = (f.firstName ?? "").trim();
  const isSpanish =
    f.issuingState?.includes("ESP") || f.nationality?.includes("ESP");

  // Unificamos todas las palabras detectadas.
  // Así nos da igual si el OCR puso el separador "<<" antes o después de "Del" o "Valle".
  const allWords = `${rawLast} ${rawFirst}`.split(/\s+/).filter(Boolean);
  if (allWords.length === 0) return out;

  let ap1 = "";
  let ap2 = "";
  let nom = "";

  // Partículas que suelen formar parte de apellidos compuestos
  const particles = ["DE", "DEL", "LA", "LAS", "LOS"];

  if (isSpanish) {
    // Para España buscamos el patrón: APELLIDO 1 + APELLIDO 2 + NOMBRE(S)
    ap1 = allWords[0];

    // ¿El segundo apellido empieza por partícula? (Ej: GARCIA DEL VALLE MARIA)
    if (allWords.length >= 4 && particles.includes(allWords[1].toUpperCase())) {
      // Caso compuesto: Tomamos las dos siguientes palabras para el 2º apellido
      ap2 = `${allWords[1]} ${allWords[2]}`;
      nom = allWords.slice(3).join(" ");
    } else if (allWords.length >= 3) {
      ap2 = allWords[1];
      nom = allWords.slice(2).join(" ");
    } else {
      nom = allWords.slice(1).join(" ");
    }
  } else {
    // Para extranjeros: El primero es el Apellido y todo lo demás el Nombre
    ap1 = allWords[0];
    nom = allWords.slice(1).join(" ");
  }

  // 2. Limpiamos la basura (K, KL, etc.) y aplicamos el formato
  out.apellido = filterOcrGarbage(ap1);
  out.apellido2 = filterOcrGarbage(ap2);
  out.nombre = filterOcrGarbage(nom);

  // 3. Procesamos el resto de campos
  const fecha = parseDate(f.birthDate);
  if (fecha) out.fechaNac = fecha;
  out.sexo = parseSex(f.sex);

  const natCode = (f.nationality ?? f.issuingState ?? "")
    .toUpperCase()
    .replace(/<+/g, "");
  out.nacionalidad = NAT[natCode] ?? "Otra";
  if (natCode === "ESP") out.pais = "ES";

  // Lógica de identificación de documento (DNI/NIE/Pasaporte)
  if (parsed.format === "TD1") {
    const soporte = (f.documentNumber ?? "").replace(/<+$/g, "").trim();
    const optional = (f.optional1 ?? "").slice(0, 9).replace(/<+$/g, "").trim();
    const isDNI = (s: string) => /^\d{8}[A-Z]$/.test(s);
    const isNIE = (s: string) => /^[XYZ]\d{7}[A-Z]$/.test(s);

    if (isDNI(optional)) {
      out.tipoDoc = "DNI";
      out.numDoc = optional;
      if (soporte.length >= 8) out.soporteDoc = soporte;
    } else if (isNIE(optional)) {
      out.tipoDoc = "NIE";
      out.numDoc = optional;
      if (soporte.length >= 8) out.soporteDoc = soporte;
    } else if (isDNI(soporte)) {
      out.tipoDoc = "DNI";
      out.numDoc = soporte;
    } else if (isNIE(soporte)) {
      out.tipoDoc = "NIE";
      out.numDoc = soporte;
    } else {
      out.tipoDoc = natCode === "ESP" ? "DNI" : "Otro";
      out.numDoc = optional || soporte;
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

// ─── DOMICILIO: parsear el texto del reverso del DNI ─────────────────────────
function parseDniBackAddress(text: string): Partial<PartialGuestData> {
  const out: Partial<PartialGuestData> = {};
  if (!text) return out;

  // 1. Limpieza total y unificación
  let cleanText = text
    .replace(/[^a-zA-Z0-9ÑñÁÉÍÓÚáéíóúüÜºª/ \-.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 2. 🛡️ CORTAFUEGOS
  cleanText = cleanText
    .split(/LUGAR|NACIMIENTO|PROVINCIA|MUNICIPIO|EQUIPO/i)[0]
    .trim();

  // 3. 🏠 BORRAR "DOMICILIO"
  const domMatch = cleanText.match(/DOM[A-Z0-9|!¡]{3,8}O/i);
  let addressBlock = cleanText;
  if (domMatch && domMatch.index !== undefined) {
    addressBlock = cleanText
      .substring(domMatch.index + domMatch[0].length)
      .trim();
  }

  // 4. ⚓ EL PIVOTE: Buscar el bloque de "Número y Piso"
  const pivotRegex =
    /(\d+\s*(?:[ºª°]|BIS|BAJO|S\/N|IZQ|DER|[0-9][A-Z]|[A-Z]\b)?)/i;
  const matchPivot = addressBlock.match(pivotRegex);

  // 5. 🧠 FILTRO HEURÍSTICO (Anti-basura OCR)
  const cleanLocality = (raw: string) => {
    let c = raw.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚüÜ\s-]/g, " ").trim();
    const validShort = new Set([
      "de",
      "la",
      "el",
      "en",
      "y",
      "del",
      "las",
      "los",
      "san",
      "sta",
      "son",
      "ses",
      "val",
    ]);

    return c
      .split(/\s+/)
      .filter((word) => {
        const low = word.toLowerCase();
        if (validShort.has(low)) return true;

        // 🎯 FRANCOTIRADOR: Matamos el holograma "sos"
        if (low === "sos" || low === "sas") return false;

        const hasVowels = /[aeiouáéíóúü]/i.test(word);
        const isRepeated = /(.)\1{2,}/i.test(word);
        const tooManyConsonants = /[^aeiouáéíóúü]{4,}/i.test(word);

        return (
          word.length > 2 && hasVowels && !isRepeated && !tooManyConsonants
        );
      })
      .join(" ");
  };

  if (matchPivot && matchPivot.index !== undefined) {
    const splitPoint = matchPivot.index + matchPivot[0].length;
    out.direccion = titleCase(addressBlock.substring(0, splitPoint).trim());

    const rawLocality = addressBlock.substring(splitPoint).trim();

    // Extraemos el CP si el OCR tuvo la suerte de leerlo
    let localityWithoutCp = rawLocality;
    const cpMatch = rawLocality.match(/(\d{5})/);
    if (cpMatch) {
      out.cp = cpMatch[1];
      localityWithoutCp = rawLocality.replace(cpMatch[1], "").trim();
    }

    // 🚀 ENVIAMOS A LA API: Todo limpio y en MAYÚSCULAS
    // Aquí NO rellenamos la provincia. Tu API se encargará de eso.
    out.ciudad = cleanLocality(localityWithoutCp).toUpperCase();
  } else {
    out.direccion = titleCase(addressBlock);
  }

  return out;
}
// ─── Preprocesado image-js ────────────────────────────────────────────────────
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
    const crop = grey.crop({ origin: { row: y, column: 0 }, width, height: h });

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
        /* ok */
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
function buildAddressVariant(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  grey: any,
  width: number,
  height: number,
): string | null {
  try {
    console.log("🛠️ 1. Preparando el recorte de la dirección...");

    // Ampliamos el radar al 60% de la tarjeta
    const addrH = Math.floor(height * 0.6);
    const addrW = Math.max(1600, Math.round(width * 2));
    const crop = grey.crop({
      origin: { row: 0, column: 0 },
      width,
      height: addrH,
    });

    // 🏆 EL FIX: Contraste extremo seguro en lugar de la Máscara.
    // Oscurece los grises y quema los blancos para eliminar el fondo.
    const processed = crop.level({ inputMin: 60, inputMax: 140 });

    const finalUrl = ijsEncodeDataURL(processed.resize({ width: addrW }));
    console.log(
      "✅ 2. Imagen de dirección procesada con éxito. Enviando a Tesseract...",
    );

    return finalUrl;
  } catch (error) {
    // Si algo falla, ahora nos lo gritará en rojo en la consola
    console.error(
      "❌ ERROR FATAL al preparar la imagen de la dirección:",
      error,
    );
    return null;
  }
}
// ─── Singleton Tesseract ──────────────────────────────────────────────────────
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
    tessedit_char_whitelist: "",
    tessedit_pageseg_mode: String(PSM.SPARSE_TEXT),
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

// ─── Hook principal ───────────────────────────────────────────────────────────
export function useDocumentOCR() {
  const { t } = useTranslation();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<OCRProgress>({ fase: "", pct: 0 });
  const cancelRef = useRef(false);

  const setFase = useCallback((fase: string, pct: number) => {
    if (!cancelRef.current) setProgress({ fase, pct: Math.round(pct) });
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
        } catch (err) {
          console.error("[OCR] EXIF:", err);
          return { ok: false, error: t("ocr.err_format") };
        }

        let mrzVariants: PrepVariant[];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let grey: any, width: number, height: number;
        try {
          setFase(t("ocr.analyzing"), 13);
          const built = await buildMrzVariants(exifBlob);
          mrzVariants = built.variants;
          grey = built.grey;
          width = built.width;
          height = built.height;
        } catch (err) {
          console.error("[OCR] buildVariants:", err);
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
          if (i === 0) {
            faseMsg = t("ocr.reading_mrz");
          } else if (i < total - 1) {
            faseMsg = t("ocr.refining_mrz", {
              current: i + 1,
              total: total - 1,
            });
          } else {
            faseMsg = t("ocr.full_analysis");
          }

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
          } catch (err) {
            console.warn(`[OCR] MRZ variante "${mrzVariants[i].label}":`, err);
          }

          if (best && best.score >= GOOD_SCORE) break;
        }

        if (cancelRef.current || _terminating) return { ok: false };

        if (!best) {
          return { ok: false, error: t("ocr.err_not_found") };
        }

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
            const addrDataURL = buildAddressVariant(grey, width, height);
            if (addrDataURL) {
              const addrText = await runTextOCR(worker, addrDataURL);
              addressData = parseDniBackAddress(addrText);

              if (addressData.ciudad) {
                const validated = await normalizeOcrCity(addressData.ciudad);
                if (validated) {
                  addressData.ciudad = validated.name;
                  addressData.cp = validated.cp;
                  addressData.provincia = validated.provincia;
                } else {
                  console.warn(
                    "La API no encontró la ciudad en BBDD:",
                    addressData.ciudad,
                  );
                }
              }
            }
          } catch (err) {
            console.warn("[OCR] API city validation error:", err);
          }
        }

        if (cancelRef.current || _terminating) return { ok: false };

        setFase(t("ocr.success"), 100);

        const mergedData: Partial<PartialGuestData> = {
          ...addressData,
          ...mrzData,
        };

        return {
          ok: true,
          data: mergedData,
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

  const terminate = useCallback(async () => {
    cancelRef.current = true;
    _terminating = true;
    if (_loading) {
      try {
        await _loading;
      } catch {
        /*  */
      }
    }
    if (_worker) {
      try {
        await _worker.terminate();
      } catch {
        /*  */
      }
      _worker = null;
      _ready = false;
      _loading = null;
    }
    _terminating = false;
  }, []);

  return { processDocument, isProcessing, progress, terminate };
}
