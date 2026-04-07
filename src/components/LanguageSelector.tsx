import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "flag-icons/css/flag-icons.min.css";

const LANGUAGES = [
  { code: "es", label: "Español", country: "es" },
  { code: "en", label: "English", country: "gb" },
  { code: "fr", label: "Français", country: "fr" },
  { code: "de", label: "Deutsch", country: "de" },
  { code: "pt", label: "Português", country: "pt" },
  { code: "it", label: "Italiano", country: "it" },
];

const FlagIcon: React.FC<{ country: string; label: string }> = ({
  country,
  label,
}) => <span className={`fi fi-${country}`} role="img" aria-label={label} />;

export const LanguageSelector: React.FC = () => {
  const { i18n } = useTranslation();
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
    LANGUAGES.find((l) => l.code === i18n.language.split("-")[0]) ??
    LANGUAGES[0];

  return (
    <div className="lang-selector" ref={containerRef}>
      <button
        type="button"
        className={`lang-btn${isOpen ? " lang-btn--open" : ""}`}
        onClick={() => setIsOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Idioma: ${current.label}`}
      >
        <FlagIcon country={current.country} label={current.label} /> {/* ← */}
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
            aria-label="Seleccionar idioma"
          >
            {LANGUAGES.map((lang) => {
              const isActive = i18n.language.startsWith(lang.code);
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
                  <FlagIcon country={lang.country} label={lang.label} />
                  <span className="lang-label">{lang.label}</span>
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
