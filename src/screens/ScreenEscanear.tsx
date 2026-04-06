import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Icon } from '@/components/ui';
import type { GuestData } from '@/types';
import { useMrzOcr, warmupMrzWorker } from '@/hooks/useMrzOcr';
import type { MrzResult } from '@/hooks/mrzParser';
import '@/App.css';

interface Props {
  onScanned: (data: Partial<GuestData>) => void;
  onSkip:    () => void;
}

// Transformador de datos del OCR a tu modelo de Guest
function mrzToGuestData(mrz: MrzResult): Partial<GuestData> {
  return {
    nombre:       mrz.nombre       || undefined,
    apellido:     mrz.apellido     || undefined,
    apellido2:    mrz.apellido2    || undefined,
    tipoDoc:      mrz.tipoDoc      || undefined,
    numDoc:       mrz.numDoc       || undefined,
    fechaNac:     mrz.fechaNac     || undefined,
    sexo:         mrz.sexo         || undefined,
    nacionalidad: mrz.nacionalidad || undefined,
  };
}

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const { t } = useTranslation();
 const { status, progress, statusText, result, error, scan, reset, preprocessCanvasUrl } = useMrzOcr();

  const [selectedFile, setSelectedFile] = useState<File | 'camera' | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  
  // Estado para controlar si la cámara web está activa
  const [isCameraActive, setIsCameraActive] = useState(false);

  // Referencias para la cámara WebRTC y galería
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // 1. Precalentar el worker al montar
  useEffect(() => {
    warmupMrzWorker();
  }, []);

  // 2. Al terminar el OCR con éxito, esperar 1.8 s y navegar al formulario
  useEffect(() => {
    if (status === 'done' && result) {
      const timeout = setTimeout(() => {
        onScanned(mrzToGuestData(result));
      }, 1800);
      return () => clearTimeout(timeout);
    }
  }, [status, result, onScanned]);

  // ── Gestión del ciclo de vida de la cámara ───────────────────────────────

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      setSelectedFile('camera');
    } catch (err) {
      console.error("Error al acceder a la cámara:", err);
      alert("No se pudo acceder a la cámara. Revisa los permisos de tu navegador.");
    }
  };

  // Limpiar hardware si el usuario cambia de pantalla de golpe
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);
// ── Conectar el vídeo cuando el elemento se renderice ──────────────────
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [isCameraActive]);
  // ── Handlers de captura ──────────────────────────────────────────────────

  const handleCaptureVideoFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "mrz_capture.jpg", { type: "image/jpeg" });
      
      setCapturedFile(file);
      stopCamera(); 
    }, 'image/jpeg', 0.9); 
  };

  const handleGallery = () => {
    galleryRef.current?.click();
  };

  const handleGalleryFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      if (!capturedFile) setSelectedFile(null);
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert(t('scan.error_size'));
      setTimeout(() => { e.target.value = ''; }, 0);
      return;
    }

    setCapturedFile(file);
    setSelectedFile(file);
    setTimeout(() => { e.target.value = ''; }, 0);
  };

  const handleProcess = async () => {
    if (!capturedFile) return;
    await scan(capturedFile);
  };

  const handleDiscard = () => {
    reset();
    setSelectedFile(null);
    setCapturedFile(null);
  };

  // ── Estados derivados ──────────────────────────────────────────────────────
  const isProcessing = (
    status === 'loading_engine' ||
    status === 'preprocessing'  ||
    status === 'recognizing'
  );

  return (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,.pdf"
        style={{ display: 'none' }}
        onChange={handleGalleryFile}
      />

      {/* Canvas oculto para extraer el frame de la cámara */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="sec-hdr">
        <h2>{t('scan.title')}</h2>
        <p>
          {t('scan.subtitle')?.split('—')[0]}—
          <strong> {t('common.optional')}</strong> —
          {t('scan.subtitle')?.split('—')[1]}
        </p>
      </div>

      <div style={{ padding: '10px 24px 0' }}>
        
        {status === 'error' && error && (
          <Alert variant="err" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        {/* ════ FASE 1: Cámara en vivo o Elección ════ */}
        {!capturedFile && status === 'idle' && (
          <>
            {isCameraActive ? (
              <div className="scan-viewport" style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  style={{ width: '100%', display: 'block', backgroundColor: '#000' }} 
                />
                
                {/* Overlay visual para guiar al usuario */}
                <div className="scan-overlay" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
                  <div className="scan-corner tl" />
                  <div className="scan-corner tr" />
                  <div className="scan-corner bl" />
                  <div className="scan-corner br" />
                </div>

                <div className="scan-controls" style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16 }}>
                  <button className="scan-main-btn" onClick={handleCaptureVideoFrame}>
                    <Icon name="camera" size={26} color="#fff" />
                  </button>
                 <button 
  className="scan-side-btn" 
  onClick={stopCamera} 
  style={{ 
    background: 'rgba(0,0,0,0.5)', 
    color: '#fff', 
    fontWeight: 'bold',
    fontSize: '16px',
    width: 'auto',
    padding: '0 16px'
  }}
>
  X
</button>
                </div>
              </div>
            ) : (
              <>
                <div className="scan-viewport" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'var(--bg-alt)', borderRadius: '16px', minHeight: '200px' }}>
                  <div className="scan-controls">
                    <button className="scan-main-btn" onClick={startCamera}>
                      <Icon name="camera" size={26} color="#fff" />
                    </button>
                  </div>
                </div>

                <div className="sep">{t('common.or')}</div>

                <div className="upload-area" onClick={handleGallery} role="button" tabIndex={0}>
                  <div className="upload-icon">
                    <Icon name="upload" size={22} color="var(--text-mid)" />
                  </div>
                  <div className="upload-title">{t('scan.upload_title')}</div>
                  <div className="upload-sub">{t('scan.upload_sub')}</div>
                </div>

                <Alert variant="info">
                  <Icon name="lock" size={13} /> {t('scan.privacy_note')}
                </Alert>
              </>
            )}
          </>
        )}

        {/* ════ FASE 2: Archivo capturado ════ */}
        {capturedFile && !isProcessing && status !== 'done' && status !== 'error' && (
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div className="upload-area done" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-lt)' }}>
              <Icon
                name={selectedFile === 'camera' ? 'camera' : 'img'}
                size={32}
                color="var(--primary)"
              />
              <div className="upload-title" style={{ marginTop: 12, color: 'var(--primary-d)' }}>
                {t('scan.captured_title')}
              </div>
              <div className="upload-sub" style={{ color: 'var(--text-mid)' }}>
                {t('scan.captured_sub')}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
              <Button variant="primary" onClick={handleProcess}>
                {t('scan.btn_process')}
              </Button>
              <Button variant="secondary" onClick={handleDiscard}>
                {t('scan.btn_discard')}
              </Button>
            </div>
          </div>
        )}

        {/* ════ FASE 3: OCR en progreso ════ */}
        {isProcessing && (
          <div style={{ padding: '24px 0', textAlign: 'center' }}>
            <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ height: '100%', background: 'var(--primary)', width: `${progress}%`, transition: 'width 0.4s ease', borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
              <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-mid)' }}>
                {statusText || t('scan.btn_reading')}
              </span>
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-low)', marginTop: 12 }}>
              {progress}%
            </p>
          </div>
        )}

        {/* ════ FASE 4: Resultado OCR ════ */}
        {status === 'done' && result && (
          <div style={{ padding: '8px 0' }}>
            {/* ── CÓDIGO DE DEPURACIÓN AÑADIR AQUÍ ────────────────────────────── */}
            {/* Solo mostramos esto si useMrzOcr nos pasa una URL de depuración */}
           {/* ── CÓDIGO DE DEPURACIÓN ────────────────────────────── */}
            {preprocessCanvasUrl && (
              <div style={{ marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-mid)', marginBottom: 8 }}>
                  [Depuración] Imagen procesada enviada a Tesseract:
                </p>
                <img 
                  src={preprocessCanvasUrl} 
                  alt="Preprocessed MRZ" 
                  style={{ 
                    maxWidth: '100%', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    display: 'block',
                    margin: '0 auto'
                  }} 
                />
              </div>
            )}
            {/* ────────────────────────────────────────────────────────────────── */}
            <Alert variant={result.valid ? 'ok' : 'warm'} style={{ marginBottom: 16 }}>
              {result.valid
                ? `✓ Documento leído correctamente (confianza: ${result.confidence}%)`
                : `⚠ Lectura parcial (${result.confidence}% de dígitos de control OK). Revise los datos.`
              }
            </Alert>

            <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r)', overflow: 'hidden', marginBottom: 16 }}>
              {(
                [
                  ['Nombre',     [result.nombre, result.apellido, result.apellido2].filter(Boolean).join(' ')],
                  ['Documento',  result.tipoDoc && result.numDoc ? `${result.tipoDoc} · ${result.numDoc}` : ''],
                  ['Nacimiento', result.fechaNac],
                  ['Sexo',       result.sexo],
                ] as [string, string][]
              ).map(([label, value]) => value ? (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 14px', borderBottom: '1px solid var(--border-lt)', fontSize: 'var(--fs-sm)' }}>
                  <span style={{ color: 'var(--text-low)' }}>{label}</span>
                  <span style={{ fontWeight: 500 }}>{value}</span>
                </div>
              ) : null)}
            </div>
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-low)', textAlign: 'center' }}>
              Cargando formulario...
            </p>
          </div>
        )}

        {/* ════ FASE 5: Error ════ */}
        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <Button variant="secondary" onClick={handleDiscard}>
              {t('scan.btn_discard')}
            </Button>
          </div>
        )}

      </div>

      {!isProcessing && status !== 'done' && !isCameraActive && (
        <>
          <div className="spacer" />
          <div className="btn-row">
            <Button variant="secondary" onClick={onSkip}>
              {t('scan.btn_manual')}
            </Button>
          </div>
          <div style={{ height: 12 }} />
        </>
      )}
    </>
  );
};