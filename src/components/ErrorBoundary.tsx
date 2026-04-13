import React from "react";
import { Translation } from "react-i18next";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error?.message ?? "Error desconocido",
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // BAJO: solo loguear en desarrollo para no exponer internos en producción.
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
    // En producción: Sentry.captureException(error, { extra: info });
  }

  handleReload = () => {
    this.setState({ hasError: false, message: "" });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <Translation>
          {(t) => (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "40px 24px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: "var(--err-bg)",
                  border: "2px solid rgba(192,57,43,.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--err)"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  width={32}
                  height={32}
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <path d="M12 9v4M12 17h.01" />
                </svg>
              </div>

              <h2
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 26,
                  fontWeight: 400,
                  color: "var(--text)",
                  marginBottom: 10,
                }}
              >
                {t("errorBoundary.title")}
              </h2>

              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-mid)",
                  lineHeight: 1.6,
                  maxWidth: 280,
                  marginBottom: 6,
                }}
              >
                {t("errorBoundary.subtitle")}
              </p>

              {/* Detalle técnico — solo en desarrollo */}
              {import.meta.env.DEV && this.state.message && (
                <code
                  style={{
                    display: "block",
                    marginBottom: 24,
                    fontSize: 11,
                    color: "var(--err)",
                    background: "var(--err-bg)",
                    padding: "6px 10px",
                    borderRadius: 8,
                    maxWidth: 320,
                    wordBreak: "break-all",
                  }}
                >
                  {this.state.message}
                </code>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  width: "100%",
                  maxWidth: 280,
                }}
              >
                <button
                  onClick={this.handleReload}
                  style={{
                    padding: "13px 20px",
                    borderRadius: 12,
                    border: "none",
                    background: "var(--primary)",
                    color: "#fff",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {t("errorBoundary.btn_retry")}
                </button>
                <button
                  onClick={() => window.location.reload()}
                  style={{
                    padding: "11px 20px",
                    borderRadius: 12,
                    border: "1.5px solid var(--border)",
                    background: "transparent",
                    color: "var(--secondary)",
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    cursor: "pointer",
                  }}
                >
                  {t("errorBoundary.btn_reload")}
                </button>
              </div>

              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-low)",
                  marginTop: 20,
                }}
              >
                {t("errorBoundary.footer")}
              </p>
            </div>
          )}
        </Translation>
      );
    }

    return this.props.children;
  }
}