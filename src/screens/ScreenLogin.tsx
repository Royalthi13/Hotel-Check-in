import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Alert } from "@/components/ui";
import { api, saveStaffToken } from "@/api/axiosInstance";
import { LanguageSelector } from "@/components/LanguageSelector";

export const ScreenLogin: React.FC<{ onSuccess: () => void }> = ({
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [username, setUsername]     = useState("");
  const [password, setPassword]     = useState("");
  const [showPass, setShowPass]     = useState(false);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);
  const [focusedField, setFocused]  = useState<"user" | "pass" | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.append("grant_type", "password");
      params.append("username",   username.trim());
      params.append("password",   password.trim());
      const { data } = await api.post("/auth/token", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
      saveStaffToken(data.access_token);
      onSuccess();
    } catch (err: unknown) {
      const e = err as Error & { status?: number };
      if (e.status === 401) {
        setError(t("login.error_incorrect_pin"));
      } else if (e.status === 429) {
        setError(t("login.error_too_many_attempts", {
          defaultValue: "Demasiados intentos. Espere unos minutos.",
        }));
      } else {
        setError(t("search.error_connection"));
      }
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = username.trim() && password.trim() && !loading;

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--secondary)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* Fondo decorativo */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        background: `
          radial-gradient(ellipse at 20% 20%, rgba(250,134,92,0.13) 0%, transparent 55%),
          radial-gradient(ellipse at 80% 80%, rgba(250,134,92,0.07) 0%, transparent 50%)
        `,
      }} />

      {/* Selector de idioma — esquina superior derecha */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <LanguageSelector />
      </div>

      {/* Tarjeta central */}
      <div style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        maxWidth: 420,
        margin: "0 24px",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24,
        padding: "48px 40px 40px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 32px 64px rgba(0,0,0,0.3)",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 56, height: 56,
            borderRadius: 16,
            background: "var(--primary)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 24px rgba(250,134,92,0.35)",
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 26, fontWeight: 600, color: "#fff",
            }}>L</span>
          </div>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 28, fontWeight: 400, color: "#fff",
            letterSpacing: "0.04em", marginBottom: 6,
          }}>
            {t("login.title")}
          </h1>
          <p style={{
            fontSize: 13, color: "rgba(255,255,255,0.45)",
            lineHeight: 1.5,
          }}>
            {t("login.subtitle")}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {error && (
            <Alert variant="err" style={{ marginBottom: 4 }}>{error}</Alert>
          )}

          {/* Campo usuario */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
            }}>
              {t("login.username_label", { defaultValue: "Usuario" })}
            </label>
            <div style={{
              position: "relative",
              borderRadius: 12,
              border: `1.5px solid ${focusedField === "user" ? "var(--primary)" : "rgba(255,255,255,0.12)"}`,
              background: "rgba(255,255,255,0.06)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: focusedField === "user" ? "0 0 0 3px rgba(250,134,92,0.15)" : "none",
            }}>
              <div style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                opacity: 0.4, pointerEvents: "none",
              }}>
                <UserIcon />
              </div>
              <input
                type="text"
                value={username}
                autoComplete="username"
                autoFocus
                onFocus={() => setFocused("user")}
                onBlur={() => setFocused(null)}
                onChange={(e) => { setUsername(e.target.value); setError(""); }}
                placeholder="recepcion"
                style={{
                  width: "100%", height: 50,
                  background: "transparent", border: "none", outline: "none",
                  paddingLeft: 44, paddingRight: 16,
                  fontSize: 15, color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
          </div>

          {/* Campo contraseña */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "rgba(255,255,255,0.5)",
            }}>
              {t("login.pin_label")}
            </label>
            <div style={{
              position: "relative",
              borderRadius: 12,
              border: `1.5px solid ${focusedField === "pass" ? "var(--primary)" : "rgba(255,255,255,0.12)"}`,
              background: "rgba(255,255,255,0.06)",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: focusedField === "pass" ? "0 0 0 3px rgba(250,134,92,0.15)" : "none",
            }}>
              <div style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                opacity: 0.4, pointerEvents: "none",
              }}>
                <LockIcon />
              </div>
              <input
                type={showPass ? "text" : "password"}
                value={password}
                autoComplete="current-password"
                onFocus={() => setFocused("pass")}
                onBlur={() => setFocused(null)}
                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                placeholder="••••••"
                style={{
                  width: "100%", height: 50,
                  background: "transparent", border: "none", outline: "none",
                  paddingLeft: 44, paddingRight: 52,
                  fontSize: 15, color: "#fff",
                  fontFamily: "'DM Sans', sans-serif",
                  letterSpacing: showPass ? "normal" : "0.2em",
                }}
              />
              {/* Ojito */}
              <button
                type="button"
                onClick={() => setShowPass((v) => !v)}
                style={{
                  position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  padding: 4, display: "flex", alignItems: "center",
                  color: showPass ? "var(--primary)" : "rgba(255,255,255,0.35)",
                  transition: "color 0.2s",
                }}
                tabIndex={-1}
                aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPass ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>

          {/* Botón */}
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              marginTop: 8,
              width: "100%", height: 52,
              borderRadius: 14, border: "none",
              background: canSubmit
                ? "var(--primary)"
                : "rgba(255,255,255,0.08)",
              color: canSubmit ? "#fff" : "rgba(255,255,255,0.3)",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 15, fontWeight: 600,
              cursor: canSubmit ? "pointer" : "not-allowed",
              transition: "all 0.2s",
              boxShadow: canSubmit ? "0 8px 24px rgba(250,134,92,0.3)" : "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 16, height: 16,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.7s linear infinite",
                }} />
                {t("common.loading")}
              </>
            ) : (
              t("login.btn_enter")
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: "center", marginTop: 24,
          fontSize: 11, color: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}>
          <LockIcon size={11} />
          {t("appShell.privacy_short")}
        </p>
      </div>
    </div>
  );
};

// ── Iconos SVG inline ─────────────────────────────────────────────────────────
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
);

const LockIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

const EyeIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOffIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);