import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "flag-icons/css/flag-icons.min.css";

// 1. Quitamos los "labels" fijos de aquí, pero mantenemos la relación código-bandera
const LANGUAGES_CONFIG = [
  { code: "es", country: "es" },
  { code: "en", country: "gb" },
  { code: "fr", country: "fr" },
  { code: "de", country: "de" },
  { code: "pt", country: "pt" },
  { code: "it", country: "it" },
];

const FlagIcon: React.FC<{ country: string; label: string }> = ({
  country,
  label,
}) => <span className={`fi fi-${country}`} role="img" aria-label={label} />;

export const LanguageSelector: React.FC = () => {
  // 2. Traemos la función 't' para traducir
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      )
        setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const current =
    LANGUAGES_CONFIG.find((l) => l.code === i18n.language.split("-")[0]) ??
    LANGUAGES_CONFIG[0];

  // 3. Obtenemos el nombre traducido dinámicamente para el idioma actual
  const currentLabel = t(`common.languages.${current.code}`);
  const ariaSelectorLabel = t("common.languages.selector_aria");

  return (
    <div className="lang-selector" ref={containerRef}>
      <button
        type="button"
        className={`lang-btn${isOpen ? " lang-btn--open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        // 4. ARIA label dinámico
        aria-label={`${ariaSelectorLabel}: ${currentLabel}`}
      >
        <FlagIcon country={current.country} label={currentLabel} />
        <span
          className="lang-code"
          style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em" }}
        >
          {current.code.toUpperCase()}
        </span>
        <svg
          className="lang-chevron"
          width="10"
          height="10"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="lang-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div
            className="lang-dropdown"
            role="listbox"
            // 5. ARIA label dinámico para la lista
            aria-label={ariaSelectorLabel}
          >
            {LANGUAGES_CONFIG.map((lang) => {
              const isActive = i18n.language.startsWith(lang.code);
              // 6. Buscamos la traducción para cada idioma de la lista
              const langLabel = t(`common.languages.${lang.code}`);

              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={`lang-option${isActive ? " active" : ""}`}
                  onClick={() => {
                    i18n.changeLanguage(lang.code);
                    setIsOpen(false);
                  }}
                >
                  <FlagIcon country={lang.country} label={langLabel} />
                  <span className="lang-label">{langLabel}</span>
                  {isActive && (
                    <svg
                      className="lang-check"
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M2.5 7l3 3 6-6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
