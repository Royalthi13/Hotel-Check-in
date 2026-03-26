import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCheckinContext } from "../context/CheckinContext";
import { Icon } from "./ui";
import { useTranslation } from "react-i18next";

export const GlobalToast: React.FC = () => {
  const { submitError, clearSubmitError, isOffline } = useCheckinContext();
  const { t } = useTranslation();

  // Auto-ocultar el error del servidor a los 6 segundos
  useEffect(() => {
    if (submitError) {
      const timer = setTimeout(() => clearSubmitError(), 6000);
      return () => clearTimeout(timer);
    }
  }, [submitError, clearSubmitError]);

  const showOffline = isOffline;
  const showError = !!submitError && !isOffline;

  return (
    <AnimatePresence>
      {(showOffline || showError) && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.9 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          style={{
            position: "fixed",
            bottom: "32px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: showOffline ? "#f59e0b" : "var(--err, #ef4444)",
            color: "#fff",
            padding: "14px 20px",
            borderRadius: "16px", // 🟢 Bordes más cuadrados para evitar cortes en textos largos
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
            fontWeight: 500,
            fontSize: "14px",
            maxWidth: "calc(100% - 32px)", // 🟢 Margen seguro en móviles
            width: "max-content",
            textAlign: "left",
          }}
        >
          {showOffline && (
            // 🟢 flexShrink: 0 evita que el icono se aplaste si el texto es muy largo
            <div style={{ flexShrink: 0, display: "flex" }}>
              <Icon name="warn" size={20} color="#fff" />
            </div>
          )}

          {/* 🟢 flex: 1 permite al texto ocupar el espacio necesario y hacer salto de línea si toca */}
          <span style={{ flex: 1, lineHeight: "1.4" }}>
            {showOffline
              ? t("common.offline") // 🟢 Traducción 100% limpia
              : submitError}
          </span>

          {showError && (
            <button
              onClick={clearSubmitError}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                display: "flex",
                marginLeft: "auto",
                flexShrink: 0, // 🟢 Evita que la X se aplaste
                color: "#fff",
                fontSize: "22px",
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
