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

const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const { t } = useTranslation();
  const pct = Math.round(value * 100);
  const color =
    value >= 0.8 ? "var(--ok)" : value >= 0.55 ? "#d97706" : "var(--err)";
  return (
    <div style={{ fontSize: 13, color, fontWeight: 500, marginTop: 4 }}>
      {pct}% -{" "}
      {value >= 0.8 ? t("scan.confidence_high") : t("scan.confidence_low")}
    </div>
  );
};

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const { t } = useTranslation();
  const { processDocument, progress, terminate } = useDocumentOCR();

  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [confianza, setConfianza] = useState<number | null>(null);
  const [cameraH, setCameraH] = useState(300);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const calc = () =>
      setCameraH(
        Math.round(
          Math.min(window.innerWidth * 0.625, window.innerHeight * 0.5),
        ),
      );
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current)
      streamRef.current.getTracks().forEach((t) => t.stop());
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }, []);

  const handleFile = useCallback(
    (f: File | null | undefined) => {
      if (!f) return;
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(f));
      setErrorMsg("");
      setFile(f);
      setPhase("selected");
    },
    [preview],
  );

  const captureFrame = useCallback(() => {
    const v = videoRef.current;

    if (!v || v.videoWidth === 0) return;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    const cw = v.clientWidth;
    const ch = v.clientHeight;

    const videoRatio = vw / vh;
    const containerRatio = cw / ch;

    let sx, sy, sw, sh;
    if (videoRatio > containerRatio) {
      sw = vh * containerRatio;
      sh = vh;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / containerRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    const boxW = sw * 0.86;
    const boxH = boxW / 1.585;
    const canvas = document.createElement("canvas");
    canvas.width = boxW;
    canvas.height = boxH;
    const ctx = canvas.getContext("2d")!;

    ctx.drawImage(
      v,
      sx + (sw - boxW) / 2,
      sy + (sh - boxH) / 2,
      boxW,
      boxH,
      0,
      0,
      boxW,
      boxH,
    );

    stopCamera();
    canvas.toBlob(
      (b) => {
        if (b) handleFile(new File([b], "scan.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.95,
    );
  }, [stopCamera, handleFile]);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = s;
      setPhase("camera");
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = s;
        }
      }, 50);
    } catch {
      nativeRef.current?.click();
    }
  }, []);

  const handleProcess = async () => {
    if (!file) return;
    setPhase("processing");
    const result = await processDocument(file);
    if (result.ok && result.data) {
      setConfianza(result.confianza ?? null);
      setPhase("success");
      setTimeout(() => onScanned({ ...result.data, docFile: file }), 1200);
    } else {
      setPhase("error");
      setErrorMsg(result.error || t("scan.error_read"));
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
      terminate();
    };
  }, [stopCamera, terminate]);

  return (
    <div
      className="ScreenEscanear"
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={nativeRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      <div
        className="sec-hdr"
        style={{
          paddingTop: "max(24px, env(safe-area-inset-top))",
          paddingRight: 24,
          paddingLeft: 24,
          paddingBottom: 15,
        }}
      >
        <h2>{t("scan.title")}</h2>
        {phase === "idle" && (
          <p style={{ marginTop: 8 }}>{t("scan.subtitle")}</p>
        )}
      </div>

      <div
        className="scan-body"
        style={{
          padding: "0 24px",
          flex: 1,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {phase === "idle" && (
          <>
            <div className="scan-viewport" onClick={startCamera}>
              <div className="scan-bg">
                <Icon name="id" size={80} color="#ffffff44" />
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

            <div
              className="scan-controls"
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "30px 0",
              }}
            >
              <button
                className="scan-main-btn"
                onClick={startCamera}
                style={{
                  background: "var(--primary)",
                  border: "none",
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="camera" size={26} color="#fff" />
              </button>
            </div>

            <button
              className="upload-area"
              onClick={() => galleryRef.current?.click()}
              style={{
                width: "100%",
                padding: 20,
                borderRadius: 16,
                border: "2px dashed var(--border)",
                textAlign: "center",
                background: "var(--bg-alt)",
              }}
            >
              <Icon name="upload" size={22} color="var(--primary)" />
              <div
                className="upload-title"
                style={{ fontWeight: 600, marginTop: 8 }}
              >
                {t("scan.upload_title")}
              </div>
              <div
                className="upload-sub"
                style={{ fontSize: 12, color: "var(--text-low)" }}
              >
                {t("scan.upload_sub")}
              </div>
            </button>

            <Alert
              variant="info"
              style={{ marginTop: "auto", marginBottom: 20 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 12,
                }}
              >
                <Icon name="lock" size={14} />
                <span>{t("scan.privacy_note")}</span>
              </div>
            </Alert>
          </>
        )}

        {phase === "camera" && (
          <div
            style={{
              width: "100%",
              height: cameraH,
              position: "relative",
              overflow: "hidden",
              background: "#000",
              borderRadius: 20,
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              className="scan-overlay"
              style={{ pointerEvents: "none", zIndex: 1 }}
            >
              <div
                style={{
                  width: "86%",
                  aspectRatio: "1.585 / 1",
                  border: "2.5px solid #FA865C",
                  borderRadius: 12,
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              />
            </div>
            <button
              onClick={captureFrame}
              className="scan-main-btn"
              style={{
                position: "absolute",
                bottom: 20,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 2,
                background: "#fff",
                border: "none",
                width: 64,
                height: 64,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="camera" size={26} color="#000" />
            </button>
          </div>
        )}

        {phase === "processing" && (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <div
              className="spinner-ocr"
              style={{
                width: 50,
                height: 50,
                border: "4px solid #eee",
                borderTopColor: "var(--primary)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <div style={{ fontWeight: 600, marginBottom: 10 }}>
              {progress.fase}
            </div>
            <div
              style={{
                height: 8,
                background: "var(--border)",
                borderRadius: 10,
                overflow: "hidden",
                margin: "15px 0",
              }}
            >
              <div
                style={{
                  width: `${progress.pct}%`,
                  height: "100%",
                  background: "var(--primary)",
                  transition: "0.3s",
                }}
              />
            </div>
            <p style={{ fontSize: 13, color: "var(--text-low)" }}>
              {progress.pct}% · {t("scan.processing_local")}
            </p>
          </div>
        )}

        {phase === "selected" && (
          <div style={{ textAlign: "center" }}>
            {file?.type === "application/pdf" ? (
              <div
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 16,
                  border: "2px solid var(--primary)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-alt)",
                }}
              >
                <Icon name="file" size={48} color="var(--primary)" />
                <span style={{ marginTop: 10, fontWeight: 500 }}>
                  {t("scan.pdf_selected")}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-low)" }}>
                  {file.name}
                </span>
              </div>
            ) : (
              <img
                src={preview!}
                alt={t("scan.preview_alt")}
                style={{
                  width: "100%",
                  borderRadius: 16,
                  border: "2px solid var(--primary)",
                }}
              />
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginTop: 20,
              }}
            >
              <Button
                variant="primary"
                style={{ height: 50 }}
                onClick={handleProcess}
              >
                {t("scan.btn_process")}
              </Button>
              <Button
                variant="secondary"
                style={{ height: 50 }}
                onClick={() => setPhase("idle")}
              >
                {t("scan.btn_discard")}
              </Button>
            </div>
          </div>
        )}

        {phase === "success" && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Icon name="checkC" size={64} color="var(--ok)" />
            <h3 style={{ color: "var(--ok)", marginTop: 15 }}>
              {t("scan.success_msg")}
            </h3>
            {confianza !== null && <ConfidenceBadge value={confianza} />}
          </div>
        )}

        {phase === "error" && (
          <div style={{ marginTop: 20 }}>
            <Alert variant="err">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {t("scan.error_read")}
              </div>
              {errorMsg}
            </Alert>
            <Button
              variant="primary"
              onClick={() => setPhase("idle")}
              style={{ marginTop: 15, width: "100%" }}
            >
              {t("scan.btn_retry")}
            </Button>
          </div>
        )}
      </div>

      {(phase === "idle" || phase === "selected") && (
        <div className="scan-footer" style={{ padding: "20px 24px 40px" }}>
          <Button
            variant="secondary"
            onClick={onSkip}
            style={{ width: "100%", height: 54, borderRadius: 14 }}
          >
            {t("scan.btn_manual")}
          </Button>
        </div>
      )}
    </div>
  );
};
