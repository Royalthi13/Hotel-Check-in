import React, { useRef, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Alert, Button, Icon } from "@/components/ui";
import { useDocumentOCR } from "@/hooks/useDocumentOCR";
import type { GuestData } from "@/types";
import "@/screens/ScreenEscanear.css";
import "@/App.css";

interface Props {
  onScanned: (data: Partial<GuestData>) => void;
  onSkip: () => void;
}

type Phase =
  | "idle"
  | "camera"
  | "selected"
  | "processing"
  | "success"
  | "error";

const SESSION_KEY = "lumina_scan_fallback_open";

// ─── Badge de confianza ───────────────────────────────────────────────────────
const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const { color, label } =
    value >= 0.8
      ? { color: "var(--ok)", label: `Lectura excelente (${pct} %)` }
      : value >= 0.55
        ? { color: "#d97706", label: `Correcta — revise los datos (${pct} %)` }
        : {
            color: "var(--err)",
            label: `Lectura parcial — verifique todo (${pct} %)`,
          };
  return (
    <div style={{ fontSize: 13, color, fontWeight: 500, marginTop: 4 }}>
      {label}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const { t } = useTranslation();
  const { processDocument, isProcessing, progress, terminate } =
    useDocumentOCR();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [warnMsg, setWarnMsg] = useState("");
  const [confianza, setConfianza] = useState<number | null>(null);

  // FIX: altura explícita del viewport de cámara para evitar expansión
  // Se calcula como min(62.5vw, 52vh) — nunca más grande que el 52% de la pantalla
  const [cameraH, setCameraH] = useState(300);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hiddenRef = useRef<HTMLDivElement>(null);
  const cameraWrapRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  // Calcular altura del viewport de cámara al montar y en resize
  useEffect(() => {
    const calc = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // ratio 16:10 del .scan-viewport, limitado al 50% del alto
      setCameraH(Math.round(Math.min(vw * 0.625, vh * 0.5)));
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  // Recovery: la página se recargó mientras la cámara nativa estaba abierta
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) {
      sessionStorage.removeItem(SESSION_KEY);
      setWarnMsg(
        "La sesión de la cámara se interrumpió al volver al navegador. " +
          "Intenta de nuevo o usa la galería para subir la foto que tomaste.",
      );
    }
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      stopCamera();
      terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FIX PANTALLA NEGRA iOS: mover el <video> al contenedor visible/oculto según fase
  // iOS Safari suspende el pipeline de renderizado del video cuando está oculto.
  // La solución es tenerlo siempre en el DOM pero moverlo al wrapper visible
  // cuando se necesita mostrar, y a un div de 1px cuando no.
  useEffect(() => {
    const video = videoRef.current;
    const hidden = hiddenRef.current;
    const wrapper = cameraWrapRef.current;
    if (!video || !hidden) return;

    if (phase === "camera" && wrapper) {
      // Estilos para cubrir el wrapper completamente
      video.style.cssText = [
        "position:absolute",
        "inset:0",
        "width:100%",
        "height:100%",
        "object-fit:cover",
        "display:block",
        "z-index:0",
      ].join(";");
      // Atributos DOM directos — React puede no haberlos sincronizado aún en iOS
      video.setAttribute("autoplay", "");
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      wrapper.appendChild(video);
      if (video.srcObject && video.paused) {
        video.play().catch(() => {
          /* autoplay policy — normal en iOS */
        });
      }
    } else {
      // Ocultar: 1px para que el browser no suspenda el elemento (distinto a display:none)
      video.style.cssText = [
        "position:fixed",
        "top:-9999px",
        "left:-9999px",
        "width:1px",
        "height:1px",
        "opacity:0",
        "pointer-events:none",
      ].join(";");
      if (video.parentElement !== hidden) hidden.appendChild(video);
    }
  }, [phase]);

  // ── Gestión de cámara ─────────────────────────────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setErrorMsg("");
    setWarnMsg("");

    if (!navigator.mediaDevices?.getUserMedia) {
      // Contexto inseguro (HTTP) o browser muy antiguo → fallback nativo
      openNativeCamera();
      return;
    }

    try {
      let stream: MediaStream;
      try {
        // Resolución ideal: suficiente para OCR pero no exagerada
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
          },
        });
      } catch {
        // Constraints relajadas: cualquier resolución disponible
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      }

      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        // El useEffect (disparado por setPhase) moverá el video y llamará play()
        // Si el video ya estaba en el wrapper (edge case), play() directamente
        if (v.parentElement === cameraWrapRef.current && v.paused) {
          v.play().catch(() => {});
        }
      }
      setPhase("camera");
    } catch (err) {
      console.warn("[Camera] getUserMedia falló:", (err as Error).message);
      // Permiso denegado o no disponible → cámara nativa como fallback
      openNativeCamera();
    }
  }, []);

  const openNativeCamera = () => {
    // Flag para detectar recarga al volver de la cámara nativa
    sessionStorage.setItem(SESSION_KEY, "true");
    nativeRef.current?.click();
  };

  const captureFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;

    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    canvas.getContext("2d")!.drawImage(v, 0, 0);

    // Liberar stream ANTES del OCR — reduce pico de RAM
    stopCamera();

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setPhase("idle");
          return;
        }
        // La foto ya viene del canvas → ya tiene EXIF aplicado
        // (drawImage sobre el video ya tiene la orientación correcta)
        const f = new File([blob], `scan_${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        handleFile(f);
      },
      "image/jpeg",
      0.95,
    );
  }, [stopCamera]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Manejo de archivos ────────────────────────────────────────────────────

  const handleFile = useCallback(
    (f: File | null | undefined) => {
      sessionStorage.removeItem(SESSION_KEY);
      if (!f) return;
      if (f.size > 25 * 1024 * 1024) {
        setErrorMsg(t("scan.error_size"));
        setPhase("idle");
        return;
      }
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(f);
      });
      setErrorMsg("");
      setWarnMsg("");
      setConfianza(null);
      setFile(f);
      setPhase("selected");
    },
    [t],
  );

  // FIX: accept="image/*" acepta cualquier imagen (HEIC, WebP, etc.)
  // La corrección EXIF y conversión de formato la hace loadExifCorrectedBlob en el hook.
  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  const onNativeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    sessionStorage.removeItem(SESSION_KEY);
    handleFile(e.target.files?.[0]);
    e.target.value = "";
  };

  // ── OCR ───────────────────────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!file) return;
    setPhase("processing");
    setErrorMsg("");
    const result = await processDocument(file);
    if (result.ok && result.data) {
      setConfianza(result.confianza ?? null);
      setPhase("success");
      setTimeout(
        () => onScanned({ ...result.data, docFile: file, docUploaded: true }),
        1200,
      );
    } else {
      setPhase("error");
      setErrorMsg(result.error ?? t("scan.error_read"));
    }
  };

  const handleDiscard = () => {
    stopCamera();
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setFile(null);
    setPhase("idle");
    setErrorMsg("");
    setWarnMsg("");
    setConfianza(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inputs siempre en el DOM */}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={onGalleryChange}
        aria-label={t("scan.btn_gallery")}
      />
      <input
        ref={nativeRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={onNativeCameraChange}
        aria-label={t("scan.btn_capture")}
      />

      {/* FIX iOS pantalla negra: video siempre en DOM, en div de 1px cuando no se usa */}
      <div
        ref={hiddenRef}
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        <video ref={videoRef} autoPlay playsInline muted />
      </div>

      {/* Cabecera */}
      <div className="sec-hdr">
        <h2>{t("scan.title")}</h2>
        <p>{t("scan.subtitle")}</p>
      </div>

      {warnMsg && (
        <div style={{ padding: "0 24px 8px" }}>
          <Alert variant="warm">{warnMsg}</Alert>
        </div>
      )}

      <div
        style={{
          padding: "0 24px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ════ IDLE ══════════════════════════════════════════════════════ */}
        {phase === "idle" && (
          <>
            <div className="scan-viewport">
              <div className="scan-bg">
                <span className="scan-ghost">
                  <Icon name="id" size={80} color="#fff" />
                </span>
              </div>
              <div className="scan-overlay">
                <div className="scan-corner tl" />
                <div className="scan-corner tr" />
                <div className="scan-corner bl" />
                <div className="scan-corner br" />
                <div className="scan-line" />
              </div>
              <div className="scan-hint">{t("scan.hint_center")}</div>
            </div>

            <div className="scan-controls">
              <button
                type="button"
                className="scan-side-btn"
                onClick={() => galleryRef.current?.click()}
                title={t("scan.btn_gallery")}
              >
                <Icon name="img" size={18} color="var(--text-mid)" />
              </button>
              <button
                type="button"
                className="scan-main-btn"
                onClick={startCamera}
                aria-label={t("scan.btn_capture")}
              >
                <Icon name="camera" size={26} color="#fff" />
              </button>
              <button
                type="button"
                className="scan-side-btn"
                onClick={() => galleryRef.current?.click()}
                title="Subir foto"
              >
                <Icon name="flash" size={18} color="var(--text-mid)" />
              </button>
            </div>

            <div className="sep">{t("common.or")}</div>

            <button
              type="button"
              className="upload-area"
              style={{ width: "100%", cursor: "pointer" }}
              onClick={() => galleryRef.current?.click()}
            >
              <div className="upload-icon">
                <Icon name="upload" size={22} color="var(--text-mid)" />
              </div>
              <div className="upload-title">{t("scan.upload_title")}</div>
              <div className="upload-sub">{t("scan.upload_sub")}</div>
            </button>

            <Alert variant="info" style={{ marginTop: 12 }}>
              <Icon name="lock" size={13} /> {t("scan.privacy_note")}
            </Alert>

            <div
              style={{
                marginTop: 12,
                padding: "12px 14px",
                background: "var(--bg)",
                borderRadius: "var(--r)",
                fontSize: 12,
                color: "var(--text-mid)",
                lineHeight: 1.7,
              }}
            >
              <strong
                style={{
                  color: "var(--text)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                💡 Para que la lectura funcione:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>
                  <strong>DNI:</strong> fotografíe el <strong>reverso</strong> —
                  las 3 líneas de código en la franja inferior
                </li>
                <li>
                  <strong>Pasaporte:</strong> fotografíe la página con la foto y
                  los datos
                </li>
                <li>
                  Iluminación uniforme, sin reflejos ni sombras sobre el
                  documento
                </li>
                <li>Documento plano y completamente visible en la foto</li>
              </ul>
            </div>
          </>
        )}

        {/* ════ CAMERA ════════════════════════════════════════════════════
            FIX EXPANSION: altura calculada explícitamente (cameraH),
            no solo con aspect-ratio. El video se inserta via useEffect.
        ════════════════════════════════════════════════════════════════ */}
        {phase === "camera" && (
          <>
            {/* FIX: height explícito calculado — nunca se expande más allá */}
            <div
              ref={cameraWrapRef}
              style={{
                width: "100%",
                height: cameraH,
                position: "relative",
                overflow: "hidden",
                background: "#000",
                borderRadius: "var(--r-lg)",
                marginBottom: 14,
                flexShrink: 0,
              }}
            >
              {/* El <video> lo mueve aquí el useEffect — no va en JSX */}

              {/* Overlay de guía de encuadre (sobre el video, z-index:1) */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                }}
              >
                {/* Marco con ratio 1.585:1 (ratio DNI físico 85.6×54mm) */}
                <div
                  style={{
                    width: "86%",
                    aspectRatio: "1.585 / 1",
                    border: "2.5px solid rgba(250,134,92,0.9)",
                    borderRadius: 8,
                    boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
                    position: "relative",
                  }}
                >
                  <div
                    className="scan-corner tl"
                    style={{ borderColor: "var(--primary)" }}
                  />
                  <div
                    className="scan-corner tr"
                    style={{ borderColor: "var(--primary)" }}
                  />
                  <div
                    className="scan-corner bl"
                    style={{ borderColor: "var(--primary)" }}
                  />
                  <div
                    className="scan-corner br"
                    style={{ borderColor: "var(--primary)" }}
                  />
                </div>
              </div>

              <div
                style={{
                  position: "absolute",
                  bottom: 10,
                  left: 0,
                  right: 0,
                  zIndex: 2,
                  textAlign: "center",
                  fontSize: 11,
                  lineHeight: 1.4,
                  color: "rgba(255,255,255,0.75)",
                  padding: "0 20px",
                }}
              >
                Reverso del DNI · Página de datos del pasaporte
              </div>
            </div>

            <div className="scan-controls">
              <button
                type="button"
                className="scan-side-btn"
                onClick={() => {
                  stopCamera();
                  setPhase("idle");
                }}
                title="Cancelar"
              >
                <Icon name="left" size={18} color="var(--text-mid)" />
              </button>
              <button
                type="button"
                className="scan-main-btn"
                onClick={captureFrame}
                aria-label="Capturar"
              >
                <Icon name="camera" size={26} color="#fff" />
              </button>
              <button
                type="button"
                className="scan-side-btn"
                onClick={() => {
                  stopCamera();
                  setPhase("idle");
                  galleryRef.current?.click();
                }}
                title={t("scan.btn_gallery")}
              >
                <Icon name="img" size={18} color="var(--text-mid)" />
              </button>
            </div>

            <p
              style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--text-low)",
                textAlign: "center",
                lineHeight: 1.5,
              }}
            >
              Encuadre el documento completo dentro del marco
            </p>
          </>
        )}

        {/* ════ SELECTED ══════════════════════════════════════════════════ */}
        {phase === "selected" && file && (
          <>
            {preview && (
              <div
                style={{
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  border: "2px solid var(--border)",
                  background: "#111",
                  maxHeight: 260,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                }}
              >
                <img
                  src={preview}
                  alt="Vista previa"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 260,
                    objectFit: "contain",
                  }}
                />
              </div>
            )}

            <div
              style={{
                padding: "13px 16px",
                background: "var(--primary-lt)",
                border: "1px solid rgba(250,134,92,.25)",
                borderRadius: "var(--r)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <Icon name="img" size={22} color="var(--primary)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--primary-d)",
                  }}
                >
                  {t("scan.captured_title")}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-mid)",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: 13,
                color: "var(--text-mid)",
                marginBottom: 18,
                lineHeight: 1.55,
              }}
            >
              {t("scan.captured_sub")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button variant="primary" onClick={handleProcess}>
                <Icon name="scan" size={16} color="#fff" />
                {t("scan.btn_process")}
              </Button>
              <Button variant="secondary" onClick={handleDiscard}>
                {t("scan.btn_discard")}
              </Button>
            </div>
          </>
        )}

        {/* ════ PROCESSING ════════════════════════════════════════════════ */}
        {phase === "processing" && (
          <div style={{ padding: "8px 0" }}>
            {preview && (
              <div
                style={{
                  borderRadius: "var(--r-lg)",
                  overflow: "hidden",
                  border: "2px solid var(--border)",
                  background: "#111",
                  maxHeight: 200,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                  position: "relative",
                }}
              >
                <img
                  src={preview}
                  alt="Procesando"
                  style={{
                    maxWidth: "100%",
                    maxHeight: 200,
                    objectFit: "contain",
                    opacity: 0.5,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 3,
                    background:
                      "linear-gradient(90deg, transparent, var(--primary), transparent)",
                    boxShadow: "0 0 8px var(--primary)",
                    animation: "scanMove 1.6s ease-in-out infinite",
                  }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 12,
                textAlign: "center",
                minHeight: 20,
              }}
            >
              {progress.fase || t("scan.btn_reading")}
            </div>
            <div
              style={{
                height: 6,
                background: "var(--border)",
                borderRadius: 99,
                overflow: "hidden",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress.pct}%`,
                  background:
                    "linear-gradient(90deg, var(--primary), var(--primary-d))",
                  borderRadius: 99,
                  transition: "width 0.35s ease",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text-low)",
                textAlign: "center",
              }}
            >
              {progress.pct} % · Procesamiento local — los datos no salen de su
              dispositivo
            </div>
          </div>
        )}

        {/* ════ SUCCESS ════════════════════════════════════════════════════ */}
        {phase === "success" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "var(--ok-bg)",
                border: "2px solid rgba(45,122,80,.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
                animation: "bounceIn .4s cubic-bezier(.34,1.56,.64,1)",
              }}
            >
              <Icon name="checkC" size={36} color="var(--ok)" />
            </div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--ok)",
                marginBottom: 4,
              }}
            >
              {t("scan.success_msg")}
            </div>
            {confianza !== null && <ConfidenceBadge value={confianza} />}
            <div
              style={{ fontSize: 12, color: "var(--text-low)", marginTop: 10 }}
            >
              Cargando formulario…
            </div>
          </div>
        )}

        {/* ════ ERROR ══════════════════════════════════════════════════════ */}
        {phase === "error" && (
          <>
            <div
              style={{
                padding: 16,
                background: "var(--err-bg)",
                border: "1px solid rgba(192,57,43,.2)",
                borderRadius: "var(--r)",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <Icon name="warn" size={18} color="var(--err)" />
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--err)",
                    marginBottom: 4,
                  }}
                >
                  No se pudo leer el documento
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--text-mid)",
                    lineHeight: 1.5,
                  }}
                >
                  {errorMsg}
                </div>
              </div>
            </div>

            <div
              style={{
                padding: "12px 14px",
                background: "var(--bg)",
                borderRadius: "var(--r)",
                marginBottom: 20,
                fontSize: 12,
                color: "var(--text-mid)",
                lineHeight: 1.7,
              }}
            >
              <strong
                style={{
                  color: "var(--text)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Causas frecuentes:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>
                  DNI: se fotografió el <strong>anverso</strong> — necesita el{" "}
                  <strong>reverso</strong>
                </li>
                <li>Reflejos o flash sobre el plástico del documento</li>
                <li>
                  Imagen borrosa o el documento no está completamente visible
                </li>
                <li>La franja inferior con el código quedó cortada</li>
              </ul>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Button
                variant="primary"
                onClick={() => {
                  handleDiscard();
                  startCamera();
                }}
              >
                <Icon name="camera" size={16} color="#fff" />
                Volver a intentar con la cámara
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  handleDiscard();
                  galleryRef.current?.click();
                }}
              >
                <Icon name="img" size={16} />
                Subir foto desde la galería
              </Button>
              <Button variant="secondary" onClick={onSkip}>
                {t("scan.btn_manual")}
              </Button>
            </div>
          </>
        )}
      </div>

      {(phase === "idle" || phase === "selected") && !isProcessing && (
        <>
          <div className="spacer" />
          <div className="btn-row">
            <Button variant="secondary" onClick={onSkip}>
              {t("scan.btn_manual")}
            </Button>
          </div>
          <div style={{ height: 12 }} />
        </>
      )}
    </>
  );
};
