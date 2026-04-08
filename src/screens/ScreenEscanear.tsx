// src/screens/ScreenEscanear.tsx
//
// Los dos inputs (cámara y galería) están SIEMPRE montados en el DOM.
// Esto evita el bug donde el input se desmontaba al cambiar el estado
// tras la captura, impidiendo que la imagen llegara al handler.
//
// FLUJO:
//   idle → (foto/fichero) → selected → (procesar) → processing → success/error

import React, { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Icon } from '@/components/ui';
import { useDocumentOCR } from '@/hooks/useDocumentOCR';
import type { GuestData } from '@/types';
import '@/screens/ScreenEscanear.css';
import '@/App.css';

interface Props {
  onScanned: (data: Partial<GuestData>) => void;
  onSkip: () => void;
}

type Phase = 'idle' | 'selected' | 'processing' | 'success' | 'error';

// ─── Badge de confianza ───────────────────────────────────────────────────────

const ConfidenceBadge: React.FC<{ value: number }> = ({ value }) => {
  const pct = Math.round(value * 100);
  const { color, label } =
    value >= 0.80 ? { color: 'var(--ok)',  label: `Lectura excelente (${pct} %)` }
    : value >= 0.55 ? { color: '#d97706',  label: `Lectura correcta — revise los datos (${pct} %)` }
    : { color: 'var(--err)', label: `Lectura parcial — compruebe todos los campos (${pct} %)` };

  return (
    <div style={{ fontSize: 13, color, fontWeight: 500, marginTop: 4 }}>
      {label}
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

export const ScreenEscanear: React.FC<Props> = ({ onScanned, onSkip }) => {
  const { t } = useTranslation();
  const { processDocument, isProcessing, progress, terminate } = useDocumentOCR();

  const [phase, setPhase]       = useState<Phase>('idle');
  const [file, setFile]         = useState<File | null>(null);
  const [preview, setPreview]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confianza, setConfianza] = useState<number | null>(null);

  // SIEMPRE MONTADOS — no condicionar al phase ──────────────────────────────
  const cameraRef  = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      terminate();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Selección de fichero ─────────────────────────────────────────────────

  const handleFile = (f: File | null | undefined) => {
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { setErrorMsg(t('scan.error_size')); return; }
    if (preview) URL.revokeObjectURL(preview);
    setErrorMsg('');
    setConfianza(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPhase('selected');
  };

  const onCameraChange  = (e: React.ChangeEvent<HTMLInputElement>) => { handleFile(e.target.files?.[0]); e.target.value = ''; };
  const onGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => { handleFile(e.target.files?.[0]); e.target.value = ''; };

  // ─── OCR ─────────────────────────────────────────────────────────────────

  const handleProcess = async () => {
    if (!file) return;
    setPhase('processing');
    setErrorMsg('');

    const result = await processDocument(file);

    if (result.ok && result.data) {
      setConfianza(result.confianza ?? null);
      setPhase('success');
      setTimeout(() => onScanned({ ...result.data, docFile: file, docUploaded: true }), 1100);
    } else {
      setPhase('error');
      setErrorMsg(result.error ?? t('scan.error_read'));
    }
  };

  const handleDiscard = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setFile(null);
    setPhase('idle');
    setErrorMsg('');
    setConfianza(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      {/* Inputs SIEMPRE en el DOM ──────────────────────────────────────── */}
      <input ref={cameraRef}  type="file" accept="image/*" capture="environment"
             style={{ display: 'none' }} onChange={onCameraChange}  aria-label={t('scan.btn_capture')} />
      <input ref={galleryRef} type="file" accept="image/*"
             style={{ display: 'none' }} onChange={onGalleryChange} aria-label={t('scan.btn_gallery')} />

      {/* Cabecera ──────────────────────────────────────────────────────── */}
      <div className="sec-hdr">
        <h2>{t('scan.title')}</h2>
        <p>{t('scan.subtitle')}</p>
      </div>

      <div style={{ padding: '10px 24px 0' }}>

        {/* ── IDLE ─────────────────────────────────────────────────────── */}
        {phase === 'idle' && (
          <>
            <div className="scan-viewport">
              <div className="scan-bg">
                <span className="scan-ghost"><Icon name="id" size={80} color="#fff" /></span>
              </div>
              <div className="scan-overlay">
                <div className="scan-corner tl" /><div className="scan-corner tr" />
                <div className="scan-corner bl" /><div className="scan-corner br" />
                <div className="scan-line" />
              </div>
              <div className="scan-hint">{t('scan.hint_center')}</div>
            </div>

            <div className="scan-controls">
              <button type="button" className="scan-side-btn"
                      onClick={() => galleryRef.current?.click()} title={t('scan.btn_gallery')}>
                <Icon name="img" size={18} color="var(--text-mid)" />
              </button>
              <button type="button" className="scan-main-btn"
                      onClick={() => cameraRef.current?.click()} aria-label={t('scan.btn_capture')}>
                <Icon name="camera" size={26} color="#fff" />
              </button>
              {/* Flash: no existe API en browser, redirige a galería */}
              <button type="button" className="scan-side-btn"
                      onClick={() => galleryRef.current?.click()} title={t('scan.btn_flash')}>
                <Icon name="flash" size={18} color="var(--text-mid)" />
              </button>
            </div>

            <div className="sep">{t('common.or')}</div>

            <button type="button" className="upload-area" style={{ width: '100%', cursor: 'pointer' }}
                    onClick={() => galleryRef.current?.click()}>
              <div className="upload-icon">
                <Icon name="upload" size={22} color="var(--text-mid)" />
              </div>
              <div className="upload-title">{t('scan.upload_title')}</div>
              <div className="upload-sub">{t('scan.upload_sub')}</div>
            </button>

            <Alert variant="info" style={{ marginTop: 12 }}>
              <Icon name="lock" size={13} /> {t('scan.privacy_note')}
            </Alert>

            {/* Consejos específicos para MRZ ───────────────────────────── */}
            <div style={{
              marginTop: 12, padding: '12px 14px',
              background: 'var(--bg)', borderRadius: 'var(--r)',
              fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.65,
            }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                💡 Para que la lectura funcione:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li><strong>DNI:</strong> fotografíe el <strong>reverso</strong> (las 3 líneas de letras y números en la franja inferior)</li>
                <li><strong>Pasaporte:</strong> fotografíe la página con la foto</li>
                <li>Iluminación uniforme, sin reflejos ni sombras sobre el texto</li>
                <li>Documento plano y completamente visible en la foto</li>
              </ul>
            </div>
          </>
        )}

        {/* ── SELECTED ─────────────────────────────────────────────────── */}
        {phase === 'selected' && file && (
          <div>
            {preview && (
              <div style={{
                borderRadius: 'var(--r-lg)', overflow: 'hidden',
                border: '2px solid var(--border)', background: '#111',
                maxHeight: 280, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: 16,
              }}>
                <img src={preview} alt="Vista previa" style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }} />
              </div>
            )}

            <div style={{
              padding: '13px 16px', background: 'var(--primary-lt)',
              border: '1px solid rgba(250,134,92,.25)', borderRadius: 'var(--r)',
              display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20,
            }}>
              <Icon name="img" size={22} color="var(--primary)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--primary-d)' }}>
                  {t('scan.captured_title')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-mid)', marginTop: 2 }}>
                  {file.name} · {(file.size / 1024).toFixed(0)} KB
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: 'var(--text-mid)', marginBottom: 20 }}>
              {t('scan.captured_sub')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="primary" onClick={handleProcess}>
                <Icon name="scan" size={16} color="#fff" />
                {t('scan.btn_process')}
              </Button>
              <Button variant="secondary" onClick={handleDiscard}>
                {t('scan.btn_discard')}
              </Button>
            </div>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────────────────── */}
        {phase === 'processing' && (
          <div style={{ padding: '16px 0', textAlign: 'center' }}>
            {preview && (
              <div style={{
                borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '2px solid var(--border)',
                background: '#111', maxHeight: 200, display: 'flex', alignItems: 'center',
                justifyContent: 'center', marginBottom: 24, position: 'relative',
              }}>
                <img src={preview} alt="Procesando" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', opacity: 0.55 }} />
                <div style={{
                  position: 'absolute', left: 0, right: 0, height: 3,
                  background: 'linear-gradient(90deg,transparent,var(--primary),transparent)',
                  boxShadow: '0 0 8px var(--primary)',
                  animation: 'scanMove 1.6s ease-in-out infinite',
                }} />
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
              {progress.fase || t('scan.btn_reading')}
            </div>

            <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden', marginBottom: 8 }}>
              <div style={{
                height: '100%', width: `${progress.pct}%`,
                background: 'linear-gradient(90deg,var(--primary),var(--primary-d))',
                borderRadius: 99, transition: 'width 0.35s ease',
              }} />
            </div>

            <div style={{ fontSize: 12, color: 'var(--text-low)' }}>
              {progress.pct} % — OCR local y seguro (los datos no salen de su dispositivo)
            </div>
          </div>
        )}

        {/* ── SUCCESS ──────────────────────────────────────────────────── */}
        {phase === 'success' && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: 'var(--ok-bg)', border: '2px solid rgba(45,122,80,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', animation: 'bounceIn .4s cubic-bezier(.34,1.56,.64,1)',
            }}>
              <Icon name="checkC" size={36} color="var(--ok)" />
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ok)', marginBottom: 4 }}>
              {t('scan.success_msg')}
            </div>
            {confianza !== null && <ConfidenceBadge value={confianza} />}
            <div style={{ fontSize: 12, color: 'var(--text-low)', marginTop: 8 }}>
              Cargando formulario…
            </div>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────── */}
        {phase === 'error' && (
          <div>
            <div style={{
              padding: 16, background: 'var(--err-bg)',
              border: '1px solid rgba(192,57,43,.2)', borderRadius: 'var(--r)',
              display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 20,
            }}>
              <Icon name="warn" size={18} color="var(--err)" />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--err)', marginBottom: 4 }}>
                  No se pudo leer el documento
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-mid)', lineHeight: 1.5 }}>
                  {errorMsg}
                </div>
              </div>
            </div>

            <div style={{
              padding: '12px 14px', background: 'var(--bg)',
              borderRadius: 'var(--r)', marginBottom: 20,
              fontSize: 12, color: 'var(--text-mid)', lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--text)', display: 'block', marginBottom: 4 }}>
                Causas frecuentes:
              </strong>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>Se fotografió el <strong>anverso</strong> del DNI — fotografíe el <strong>reverso</strong></li>
                <li>Reflejos de luz o flash sobre el documento</li>
                <li>Imagen borrosa (mueva el teléfono despacio)</li>
                <li>La franja inferior del documento (el código) quedó cortada</li>
              </ul>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button variant="primary" onClick={handleDiscard}>
                <Icon name="camera" size={16} color="#fff" />
                Intentar con otra foto
              </Button>
              <Button variant="secondary" onClick={onSkip}>
                {t('scan.btn_manual')}
              </Button>
            </div>
          </div>
        )}

      </div>

      {/* Botón saltar ──────────────────────────────────────────────────── */}
      {(phase === 'idle' || phase === 'selected') && !isProcessing && (
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