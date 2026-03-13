import React, { useRef, useState } from 'react';
import { Alert, Button, Icon } from '../components/ui';
import type { GuestData } from '../types';

interface Props {
  /** Llama cuando el escaneo/upload proporciona datos prefill */
  onScanned: (data: Partial<GuestData>) => void;
  /** El usuario prefiere saltarse el escaneo y rellenar manualmente */
  onSkip: () => void;
}

// Datos simulados que "extraería" el OCR del documento
const MOCK_SCAN_DATA: Partial<GuestData> = {
  nombre: 'Carlos',
  apellido: 'García',
  apellido2: 'López',
  tipoDoc: 'DNI',
  numDoc: '12345678A',
  fechaNac: '1985-03-22',
  nacionalidad: 'Española',
  sexo: 'Hombre',
};

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleScan = () => {
    setScanning(true);
    // Simula el proceso de captura + OCR
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
      // Pequeño delay para que el usuario vea el estado "success"
      setTimeout(() => onScanned(MOCK_SCAN_DATA), 900);
    }, 2600);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
      setTimeout(() => onScanned({ ...MOCK_SCAN_DATA, docFile: file, docUploaded: true }), 800);
    }, 1800);
  };

  return (
    <div className="screen">
      <div className="sec-hdr">
        <h2>Escanear documento</h2>
        <p>
          Coloque su DNI o pasaporte dentro del marco y pulse capturar. Los datos se
          rellenarán automáticamente. <strong>Este paso es opcional</strong> — puede
          saltarlo y rellenar todo a mano.
        </p>
      </div>

      <div style={{ padding: '10px 24px 0' }}>
        {/* Viewport de cámara simulado */}
        <div className="scan-viewport">
          <div className="scan-bg">
            <span className="scan-ghost">
              <Icon name="id" size={80} color="#fff" />
            </span>
          </div>
          {/* Frame overlay */}
          <div className="scan-overlay">
            <div className="scan-corner tl" />
            <div className="scan-corner tr" />
            <div className="scan-corner bl" />
            <div className="scan-corner br" />
            {scanning && <div className="scan-line" />}
          </div>
          <div className="scan-hint">
            {scanned
              ? '✓ Documento detectado'
              : scanning
                ? 'Procesando…'
                : 'Centre el documento en el marco'
            }
          </div>
        </div>

        {/* Controles de cámara */}
        {!scanned && (
          <div className="scan-controls">
            <button
              className="scan-side-btn"
              onClick={() => fileRef.current?.click()}
              title="Subir desde galería"
              aria-label="Subir imagen desde galería"
            >
              <Icon name="img" size={18} color="var(--text-mid)" />
            </button>

            <button
              className="scan-main-btn"
              onClick={handleScan}
              disabled={scanning}
              aria-label="Capturar documento"
            >
              {scanning
                ? <div className="spinner" style={{ width: 26, height: 26, borderWidth: 2 }} />
                : <Icon name="camera" size={26} color="#fff" />
              }
            </button>

            <button className="scan-side-btn" title="Flash" aria-label="Activar flash">
              <Icon name="flash" size={18} color="var(--text-mid)" />
            </button>
          </div>
        )}

        {scanned && (
          <Alert variant="ok" style={{ margin: '8px 0 12px' }}>
            Documento escaneado correctamente. Procesando datos para rellenar el formulario…
          </Alert>
        )}

        {!scanned && (
          <>
            <div className="sep">o bien</div>
            <label htmlFor="scan-upload">
              <div className="upload-area">
                <div className="upload-icon">
                  <Icon name="upload" size={22} color="var(--text-mid)" />
                </div>
                <div className="upload-title">Subir foto del documento</div>
                <div className="upload-sub">JPG, PNG o PDF · Máx. 10 MB</div>
              </div>
            </label>
            <input
              id="scan-upload"
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              style={{ display: 'none' }}
              onChange={handleFile}
            />

            <Alert variant="info">
              <Icon name="lock" size={13} /> Transmisión cifrada. El documento se elimina tras el check-in conforme al RGPD.
            </Alert>
          </>
        )}
      </div>

      <div className="spacer" />
      <div className="btn-row">
        <Button variant="secondary" onClick={onSkip}>
          Prefiero rellenar los datos manualmente
        </Button>
      </div>
      <div style={{ height: 12 }} />
    </div>
  );
};