import React, { useRef, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui"; // ✅ Importamos el icono para el botón del flash

interface CameraScannerProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onClose,
}) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null); // ✅ Usamos useRef en vez de useState para evitar errores del linter

  // 👇 Estados para controlar el flash
  const [isFlashSupported, setIsFlashSupported] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  // Iniciar cámara
  useEffect(() => {
    let activeStream: MediaStream | null = null; // Guardamos una copia interna

    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        activeStream = s;
        streamRef.current = s; // Lo guardamos para poder encender el flash luego

        if (videoRef.current) videoRef.current.srcObject = s;

        // 👇 Comprobamos si el móvil tiene flash (torch) sin usar "any"
        const track = s.getVideoTracks()[0];
        const capabilities =
          track.getCapabilities() as MediaTrackCapabilities & {
            torch?: boolean;
          };
        if (capabilities.torch) {
          setIsFlashSupported(true);
        }
      } catch (err) {
        console.error("Error acceso cámara:", err);
      }
    }

    startCamera();

    // Al desmontar el componente, apagamos usando la copia interna
    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
      setFlashOn(false); // Reiniciamos el botón
    };
  }, []);

  // 👇 Función para encender y apagar el flash
  const toggleFlash = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];

    try {
      await track.applyConstraints({
        advanced: [
          { torch: !flashOn } as MediaTrackConstraintSet & { torch?: boolean },
        ],
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error("Error al cambiar el flash:", err);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // 1. Definimos el "Rectángulo de interés"
    const cropWidth = video.videoWidth * 0.8;
    const cropHeight = cropWidth * 0.63; // Proporción ID-1 (DNI)
    const startX = (video.videoWidth - cropWidth) / 2;
    const startY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 2. CAPTURA + ENHANCE (Mejora de imagen)
    ctx.filter = "contrast(1.2) brightness(1.1) saturate(0.8)";

    ctx.drawImage(
      video,
      startX,
      startY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );

    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/png",
      0.95,
    );
  };

  return (
    <div style={styles.container}>
      <video ref={videoRef} autoPlay playsInline style={styles.video} />

      {/* 🖼️ EL MARCO GUÍA */}
      <div style={styles.overlay}>
        <div style={styles.guideBox}>
          <div style={styles.cornerTopLeft} />
          <div style={styles.cornerTopRight} />
          <div style={styles.cornerBottomLeft} />
          <div style={styles.cornerBottomRight} />
        </div>
      </div>

      {/* 👇 BOTÓN DEL FLASH (Solo aparece si el móvil lo soporta) 👇 */}
      {isFlashSupported && (
        <button
          onClick={toggleFlash}
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10000,
            background: flashOn ? "#FA865C" : "rgba(0,0,0,0.6)",
            border: "none",
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.2s",
          }}
        >
          <Icon name="flash" size={20} color="#fff" />
        </button>
      )}

      <div style={styles.controls}>
        <button onClick={onClose} style={styles.btnCancel}>
          {t("common.cancel")}
        </button>
        <button onClick={capturePhoto} style={styles.btnCapture}>
          {t("scan.btn_capture")}
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

// Estilos
const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#000",
    zIndex: 9999,
  },
  video: { width: "100%", height: "100%", objectFit: "cover" },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  guideBox: {
    width: "85vw",
    height: "54vw",
    border: "2px solid rgba(255,255,255,0.3)",
    borderRadius: "12px",
    position: "relative",
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
  },
  btnCapture: {
    padding: "15px 30px",
    borderRadius: "50px",
    backgroundColor: "#fff",
    border: "none",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  controls: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
  },
  btnCancel: {
    color: "#fff",
    background: "none",
    border: "none",
    fontSize: "16px",
  },
};
