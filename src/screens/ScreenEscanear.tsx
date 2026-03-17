import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next"; // 1. Importamos el hook de traducción
import { Alert, Button, Icon } from "@/components/ui";
import type { GuestData } from "@/types";

interface Props {
  onScanned: (data: Partial<GuestData>) => void;
  onSkip: () => void;
}

const MOCK_SCAN_DATA: Partial<GuestData> = {
  nombre: "Carlos",
  apellido: "García",
  apellido2: "López",
  tipoDoc: "DNI",
  numDoc: "12345678M", // ← letra correcta: 12345678 % 23 = 6 → M
  fechaNac: "1985-03-22",
  nacionalidad: "Española",
  sexo: "Hombre",
};

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const { t } = useTranslation(); // 2. Inicializamos el traductor
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
      // 3. Traducimos el alert nativo (o puedes usar tu componente Alert)
      alert(t("scan.error_size"));
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
        // 4. Traducimos el error de lectura
        setError(t("scan.error_read"));
      }
    }, 2500);
  };

  return (
    <>
      <div className="sec-hdr">
        <h2>{t("scan.title")}</h2>
        <p>
          {/* Combinamos texto traducido con JSX (el <strong>) */}
          {t("scan.subtitle").split("—")[0]}—
          <strong> {t("common.optional")}</strong> —
          {t("scan.subtitle").split("—")[1]}
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
              <div className="scan-hint">{t("scan.hint_center")}</div>
            </div>

            <div className="scan-controls">
              <button
                className="scan-side-btn"
                onClick={() => fileRef.current?.click()}
                title={t("scan.btn_gallery")}
                aria-label={t("scan.btn_gallery")}
              >
                <Icon name="img" size={18} color="var(--text-mid)" />
              </button>

              <button
                className="scan-main-btn"
                onClick={handleScan}
                aria-label={t("scan.btn_capture")}
              >
                <Icon name="camera" size={26} color="#fff" />
              </button>

              <button
                className="scan-side-btn"
                title={t("scan.btn_flash")}
                aria-label={t("scan.btn_flash")}
              >
                <Icon name="flash" size={18} color="var(--text-mid)" />
              </button>
            </div>

            <div className="sep">{t("common.or")}</div>
            <label htmlFor="scan-upload">
              <div className="upload-area">
                <div className="upload-icon">
                  <Icon name="upload" size={22} color="var(--text-mid)" />
                </div>
                <div className="upload-title">{t("scan.upload_title")}</div>
                <div className="upload-sub">{t("scan.upload_sub")}</div>
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
              <Icon name="lock" size={13} /> {t("scan.privacy_note")}
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
                {t("scan.captured_title")}
              </div>
              <div className="upload-sub" style={{ color: "var(--text-mid)" }}>
                {t("scan.captured_sub")}
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
                    {t("scan.btn_reading")}
                  </>
                ) : (
                  t("scan.btn_process")
                )}
              </Button>
              <Button
                variant="secondary"
                onClick={descartarFoto}
                disabled={scanning}
              >
                {t("scan.btn_discard")}
              </Button>
            </div>
          </div>
        )}

        {scanned && (
          <Alert variant="ok" style={{ margin: "8px 0 12px" }}>
            {t("scan.success_msg")}
          </Alert>
        )}
      </div>

      {!scanning && !scanned && (
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
