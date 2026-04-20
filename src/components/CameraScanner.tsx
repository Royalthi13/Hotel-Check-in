import React, { useRef, useEffect, useState } from "react";

interface CameraScannerProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

export const CameraScanner: React.FC<CameraScannerProps> = ({
  onCapture,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Iniciar cámara
  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        console.error("Error acceso cámara:", err);
      }
    }
    startCamera();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    // 1. Definimos el "Rectángulo de interés" (donde está el marco en la UI)
    // Supongamos que el DNI ocupa el 80% del ancho y está centrado.
    const cropWidth = video.videoWidth * 0.8;
    const cropHeight = cropWidth * 0.63; // Proporción ID-1 (DNI)
    const startX = (video.videoWidth - cropWidth) / 2;
    const startY = (video.videoHeight - cropHeight) / 2;

    canvas.width = cropWidth;
    canvas.height = cropHeight;

    // 2. CAPTURA + ENHANCE (Mejora de imagen)
    // Aplicamos un poco de contraste y nitidez vía filtros de Canvas
    ctx.filter = "contrast(1.2) brightness(1.1) saturate(0.8)";

    ctx.drawImage(
      video,
      startX,
      startY,
      cropWidth,
      cropHeight, // Recorte de la fuente
      0,
      0,
      cropWidth,
      cropHeight, // Dibujo en el destino
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

      {/* 🖼️ EL MARCO GUÍA (Overlay) */}
      <div style={styles.overlay}>
        <div style={styles.guideBox}>
          <div style={styles.cornerTopLeft} />
          <div style={styles.cornerTopRight} />
          <div style={styles.cornerBottomLeft} />
          <div style={styles.cornerBottomRight} />
        </div>
      </div>

      <div style={styles.controls}>
        <button onClick={onClose} style={styles.btnCancel}>
          Cancelar
        </button>
        <button onClick={capturePhoto} style={styles.btnCapture}>
          FOTOGRAFIAR
        </button>
      </div>
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
};

// Estilos rápidos para que veas el diseño
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
    backgroundColor: "rgba(0,0,0,0.5)", // Oscurece fuera del marco
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
  },
  controls: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    display: "flex",
    justifyContent: "space-around",
  },
  btnCancel: { color: "#fff", background: "none", border: "none" },
};
