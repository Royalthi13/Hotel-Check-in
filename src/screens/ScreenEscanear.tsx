import React, { useRef, useState } from 'react';
import { Alert, Button, Icon } from '@/components/ui';
import type { GuestData } from '@/types';

interface Props {
  onScanned: (data: Partial<GuestData>) => void;
  onSkip: () => void;
}

const MOCK_SCAN_DATA: Partial<GuestData> = {
  nombre: 'Carlos',
  apellido: 'García',
  apellido2: 'López',
  tipoDoc: 'DNI',
  numDoc: '12345678M', // ← letra correcta: 12345678 % 23 = 6 → M
  fechaNac: '1985-03-22',
  nacionalidad: 'Española',
  sexo: 'Hombre',
};

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | "camera" | null>(
    null,
  );

  const fileRef = useRef<HTMLInputElement>(null);

  const handleScan = () => {
    setError("");
    setSelectedFile("camera");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20971520) {
      alert("El archivo es demasiado grande. El máximo permitido son 20 MB.");
      e.target.value = "";
      return;
    }

    setError("");
    setSelectedFile(file);
    e.target.value = "";
  };

  const descartarFoto = () => {
    setSelectedFile(null);
    setError("");
  };

  const procesarDocumento = () => {
    setError("");
    setScanning(true);

    setTimeout(() => {
      setScanning(false);

      const lecturaExitosa = Math.random() > 0.3;

      if (lecturaExitosa) {
        setScanned(true);
        const dataPayload =
          selectedFile === "camera"
            ? MOCK_SCAN_DATA
            : {
                ...MOCK_SCAN_DATA,
                docFile: selectedFile as File,
                docUploaded: true,
              };

        setTimeout(() => onScanned(dataPayload), 800);
      } else {
        setError(
          "No hemos podido leer los datos con claridad. Asegúrese de que la imagen tiene buena luz, no está borrosa y no tiene reflejos del flash.",
        );
      }
    }, 2500);
  };

  return (
    <>
      <div className="sec-hdr">
        <h2>Escanear documento</h2>
        <p>
          Coloque su DNI o pasaporte dentro del marco y pulse capturar. Los
          datos se rellenarán automáticamente.{" "}
          <strong>Este paso es opcional</strong> — puede saltarlo y rellenar
          todo a mano.
        </p>
      </div>

      <div style={{ padding: "10px 24px 0" }}>
        {error && (
          <Alert variant="err" style={{ marginBottom: 16 }}>
            {error}
          </Alert>
        )}

        {!selectedFile && !scanned && (
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
              </div>
              <div className="scan-hint">Centre el documento en el marco</div>
            </div>

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
                aria-label="Capturar documento"
              >
                <Icon name="camera" size={26} color="#fff" />
              </button>

              <button
                className="scan-side-btn"
                title="Flash"
                aria-label="Activar flash"
              >
                <Icon name="flash" size={18} color="var(--text-mid)" />
              </button>
            </div>

            <div className="sep">o bien</div>
            <label htmlFor="scan-upload">
              <div className="upload-area">
                <div className="upload-icon">
                  <Icon name="upload" size={22} color="var(--text-mid)" />
                </div>
                <div className="upload-title">Subir foto del documento</div>
                <div className="upload-sub">JPG, PNG o PDF · Máx. 20 MB</div>
              </div>
            </label>
            <input
              id="scan-upload"
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              capture="environment"
              style={{ display: "none" }}
              onChange={handleFile}
            />
            <Alert variant="info">
              <Icon name="lock" size={13} /> Los documentos escaneados no serán
              almacenados y solo se extraerán los datos necesarios.
            </Alert>
          </>
        )}

        {selectedFile && !scanned && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div
              className="upload-area done"
              style={{
                borderColor: "var(--primary)",
                backgroundColor: "var(--primary-lt)",
              }}
            >
              <Icon
                name={selectedFile === "camera" ? "camera" : "img"}
                size={32}
                color="var(--primary)"
              />
              <div
                className="upload-title"
                style={{ marginTop: 12, color: "var(--primary-d)" }}
              >
                Imagen capturada
              </div>
              <div className="upload-sub" style={{ color: "var(--text-mid)" }}>
                Pulse en Procesar para extraer los datos de forma segura.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 24,
              }}
            >
              <Button
                variant="primary"
                onClick={procesarDocumento}
                disabled={scanning}
              >
                {scanning ? (
                  <>
                    <div
                      className="spinner"
                      style={{ width: 18, height: 18, borderWidth: 2 }}
                    />{" "}
                    Leyendo datos...
                  </>
                ) : (
                  "Procesar documento"
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={descartarFoto}
                disabled={scanning}
              >
                Descartar y probar otra vez
              </Button>
            </div>
          </div>
        )}

        {scanned && (
          <Alert variant="ok" style={{ margin: "8px 0 12px" }}>
            Documento leído con éxito. Cargando formulario...
          </Alert>
        )}
      </div>

      {!scanning && !scanned && (
        <>
          <div className="spacer" />
          <div className="btn-row">
            <Button variant="secondary" onClick={onSkip}>
              Prefiero rellenar los datos manualmente
            </Button>
          </div>
          <div style={{ height: 12 }} />
        </>
      )}
    </>
  );
};
