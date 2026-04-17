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

// ─── FIX: filtrar basura OCR de los nombres ───────────────────────────────────
function filterOcrGarbage(raw: string): string {
  if (!raw) return "";

  // 1. EL HACHAZO ORTOGRÁFICO (El definitivo)
  const textoLimpio = raw.replace(
    /([A-ZÁÉÍÓÚÑa-záéíóúñ])?([KLXZ<]{3,}.*$)/i,
    (_match, prevChar, garbage) => {
      if (!prevChar) return "";

      const isVowel = /[AEIOUÁÉÍÓÚaeiouáéíóú]/i.test(prevChar);

      if (garbage.toUpperCase().startsWith("L") && isVowel) {
        return prevChar + "L";
      }

      return prevChar;
    },
  );

  // 2. Limpieza de palabras sueltas
  return textoLimpio
    .split(/\s+/)
    .filter((word) => {
      if (!word || word.length < 2) return false;
      const vowels = (word.match(/[AEIOUaeiouÁÉÍÓÚáéíóú]/g) || []).length;
      const vowelRatio = vowels / word.length;

      if (vowelRatio < 0.15 && word.length > 2) return false;

      const uniqueChars = new Set(word.toUpperCase()).size;
      if (uniqueChars <= 2 && word.length >= 5) return false;

      return true;
    })
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

// ─── Helpers genéricos ────────────────────────────────────────────────────────

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
    .map((w, i) =>
      (!w ? "" : i === 0 || !preps.has(w))
        ? w.charAt(0).toUpperCase() + w.slice(1)
        : w,
    )
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

// ─── Líneas candidatas MRZ ────────────────────────────────────────────────────

function fitLine(line: string, len: number) {
  return line.length >= len ? line.slice(0, len) : line.padEnd(len, "<");
}

function cleanLine(raw: string) {
  return raw
    .toUpperCase()
    .trim()
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
      /* noop */
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

  const libLast = (f.lastName ?? "").trim();
  const libFirst = (f.firstName ?? "").trim();

  if (libLast) {
    const parts = libLast.split(/\s+/).filter(Boolean);
    const apellido = filterOcrGarbage(parts[0] ?? "");
    const apellido2 = filterOcrGarbage(parts.slice(1).join(" "));
    if (apellido) out.apellido = apellido;
    if (apellido2) out.apellido2 = apellido2;
  }
  if (libFirst) {
    const nombre = filterOcrGarbage(libFirst);
    if (nombre) out.nombre = nombre;
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

// ─── DOMICILIO: parsear el texto del reverso del DNI ─────────────────────────

// ─── DOMICILIO: parsear el texto del reverso del DNI ─────────────────────────

function parseDniBackAddress(text: string): Partial<PartialGuestData> {
  const out: Partial<PartialGuestData> = {};
  if (!text) return out;

  // 1. Dividimos en líneas y filtramos vacías
  const validLines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 2. Buscamos DOMICILIO
  const domIdx = validLines.findIndex((l) =>
    /domicili[oa]?|adre[çc]a|helbidea|enderezo/i.test(l),
  );
  if (domIdx === -1) return out;

  const contentLines = validLines.slice(domIdx + 1);

  // 3. Intentar cazar el CP (por si hay suerte)
  for (const line of contentLines) {
    const cpMatch = line.match(/\b(\d{5})\b/);
    if (cpMatch) {
      out.cp = cpMatch[1];
      break;
    }
  }

  // 4. Limpiar líneas de basura (como "<<<")
  const textLines = contentLines.filter((l) => {
    if (/[<]{2,}/.test(l)) return false;
    if (l.replace(/[^a-zA-Z0-9]/g, "").length < 1) return false;
    return true;
  });

  // 5. DIRECCIÓN: Cogemos las primeras líneas
  const addressParts = [];
  for (let i = 0; i < Math.min(3, textLines.length); i++) {
    const l = textLines[i];
    if (/\b\d{5}\b/.test(l)) break;
    const cleanLine = l.replace(/[|]/g, "I").replace(/\]/g, "1");
    addressParts.push(cleanLine);
  }

  if (addressParts.length > 0) {
    out.direccion = titleCase(addressParts.join(" ").replace(/\s{2,}/g, " "));
  }

  // 6. CIUDAD Y PROVINCIA (CON FILTRO ANTI-BASURA)
  const cleanLocation = (raw: string) => {
    // Lista de preposiciones/artículos válidos en España
    const validPreps = new Set([
      "de",
      "del",
      "el",
      "la",
      "las",
      "los",
      "y",
      "en",
      "a",
      "al",
      "l",
      "d",
      "s",
    ]);

    return raw
      .split(/\s+/)
      .filter((word) => {
        const w = word.toLowerCase().replace(/[^a-zñáéíóúü]/g, "");
        if (!w) return false;
        // Si la palabra tiene 1 o 2 letras, SOLO sobrevive si está en la lista válida
        if (w.length <= 2 && !validPreps.has(w)) return false;
        return true;
      })
      .join(" ");
  };

  const remainingLines = textLines
    .slice(addressParts.length)
    .filter((l) => l.replace(/[^a-zA-Z]/g, "").length >= 4);

  if (remainingLines.length >= 2) {
    out.provincia = titleCase(
      cleanLocation(remainingLines[remainingLines.length - 1]),
    );
    out.ciudad = titleCase(
      cleanLocation(remainingLines[remainingLines.length - 2]),
    );
  } else if (remainingLines.length === 1) {
    out.ciudad = titleCase(cleanLocation(remainingLines[0]));
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
    /* ok */
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
    const addrH = Math.floor(height * 0.45);
    const addrW = Math.max(1400, Math.round(width * 1.8));

    const crop = grey.crop({
      origin: { row: 0, column: 0 },
      width,
      height: addrH,
    });
    return ijsEncodeDataURL(
      crop.level({ inputMin: 20, inputMax: 230 }).resize({ width: addrW }),
    );
  } catch {
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
  _loading = createWorker("eng", 1, {
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
    tessedit_pageseg_mode: String(PSM.AUTO),
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

// ─── Hook principal ───────────────────────────────────────────────────────────

export function useDocumentOCR() {
  const { t } = useTranslation(); // <--- INYECTAMOS I18N AQUÍ
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
          return {
            ok: false,
            error: t("ocr.err_format"),
          };
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
          return {
            ok: false,
            error: t("ocr.err_size"),
          };
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
          return {
            ok: false,
            error: t("ocr.err_not_found"),
          };
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

        if (
          best.result.format === "TD1" &&
          !cancelRef.current &&
          !_terminating
        ) {
          try {
            const addrDataURL = buildAddressVariant(grey, width, height);
            if (addrDataURL) {
              const addrText = await runTextOCR(worker, addrDataURL);
              console.log("=========================================");
              console.log("👀 TEXTO BRUTO QUE LEE EL ESCÁNER:");
              console.log(addrText);
              console.log("=========================================");
              addressData = parseDniBackAddress(addrText);
              console.log("🧩 LO QUE EL ESCÁNER HA INTENTADO EXTRAER:");
              console.log(addressData);
              console.log("=========================================");
            }
          } catch (err) {
            console.warn("[OCR] address extraction:", err);
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
    [setFase, t], // <-- IMPORTANTE: t debe estar en las dependencias
  );

  const terminate = useCallback(async () => {
    cancelRef.current = true;
    _terminating = true;
    if (_loading) {
      try {
        await _loading;
      } catch {
        /* ok */
      }
    }
    if (_worker) {
      try {
        await _worker.terminate();
      } catch {
        /* ok */
      }
      _worker = null;
      _ready = false;
      _loading = null;
    }
    _terminating = false;
  }, []);

  return { processDocument, isProcessing, progress, terminate };
}
