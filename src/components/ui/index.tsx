import React from "react";
import type { Reserva } from "../../types";
import "@/components/ui/buttons.css";
import "@/components/ui/forms.css";
import "@/components/ui/alerts.css";
import "@/components/ui/misc.css";

// ═══════════════════════════════════════════════════════════════════════════
// ICON NAMES
// ═══════════════════════════════════════════════════════════════════════════
export type IconName =
  | "left"
  | "right"
  | "check"
  | "checkC"
  | "clipboard"
  | "scan"
  | "upload"
  | "camera"
  | "id"
  | "user"
  | "users"
  | "calendar"
  | "bed"
  | "lock"
  | "info"
  | "warn"
  | "search"
  | "edit"
  | "flash"
  | "img"
  | "clock"
  | "plus"
  | "minus"
  | "hotel";

const PATHS: Record<IconName, string[]> = {
  left: ["M19 12H5", "M12 19l-7-7 7-7"],
  right: ["M5 12h14", "M12 5l7 7-7 7"],
  check: ["M20 6 9 17l-5-5"],
  checkC: ["M9 12l2 2 4-4", "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"],
  scan: ["M4 7V4h3", "M17 4h3v3", "M4 17v3h3", "M20 17v3h-3", "M12 8v4l3 1.5"],
  upload: [
    "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
    "M17 8l-5-5-5 5",
    "M12 3v12",
  ],
  camera: [
    "M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z",
    "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  id: [
    "M2 5h20v14H2z",
    "M8 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
    "M13 9h5",
    "M13 12h5",
    "M13 15h3",
  ],
  user: [
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  users: [
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    "M23 21v-2a4 4 0 0 0-3-3.87",
    "M16 3.13a4 4 0 0 1 0 7.75",
  ],
  calendar: ["M3 4h18v18H3z", "M16 2v4", "M8 2v4", "M3 10h18"],
  bed: [
    "M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8",
    "M2 20h20",
    "M4 10V6a2 2 0 0 1 2-2h4",
    "M12 10V4",
  ],
  lock: [
    "M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z",
    "M7 11V7a5 5 0 0 1 10 0v4",
  ],
  info: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 16v-4", "M12 8h.01"],
  warn: [
    "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
    "M12 9v4",
    "M12 17h.01",
  ],
  search: ["M21 21l-4.35-4.35", "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"],
  edit: [
    "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7",
    "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z",
  ],
  flash: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  img: [
    "M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z",
    "M8.5 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
    "M21 15l-5-5L5 21",
  ],
  clock: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  plus: ["M12 5v14", "M5 12h14"],
  minus: ["M5 12h14"],
  hotel: ["M3 22V6l9-4 9 4v16", "M9 22V12h6v10", "M12 2v4"],
  clipboard: [
    "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
    "M9 2h6v4H9z",
  ],
};

export const Icon: React.FC<IconProps> = ({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 2,
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    width={size}
    height={size}
    style={{ flexShrink: 0 }}
  >
    {(PATHS[name] ?? []).map((d, i) => (
      <path key={i} d={d} />
    ))}
  </svg>
);

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}
export interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}
export const Field: React.FC<FieldProps> = ({
  label,
  required,
  error,
  children,
}) => (
  <div className="field">
    <label>
      {label} {required && <span className="req">*</span>}
    </label>
    {children}
    {error && (
      <span className="field-err">
        <Icon name="warn" size={11} />
        {error}
      </span>
    )}
  </div>
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  iconLeft?: IconName;
  iconRight?: IconName;
}
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  iconLeft,
  iconRight,
  children,
  className,
  ...rest
}) => (
  <button
    className={`btn-${variant}${className ? ` ${className}` : ""}`}
    {...rest}
  >
    {iconLeft && <Icon name={iconLeft} size={17} />} {children}{" "}
    {iconRight && <Icon name={iconRight} size={17} />}
  </button>
);

export type AlertVariant = "info" | "ok" | "err" | "warm";
export interface AlertProps {
  variant?: AlertVariant;
  icon?: IconName;
  
  children: React.ReactNode;
  style?: React.CSSProperties;
}
const ALERT_DEFAULT_ICON: Record<AlertVariant, IconName> = {
  info: "info",
  ok: "checkC",
  err: "warn",
  warm: "info",
};
export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  icon,
  children,
  style,
}) => (
  <div className={`alert alert-${variant}`} style={style}>
    <Icon name={icon ?? ALERT_DEFAULT_ICON[variant]} size={14} />{" "}
    <span>{children}</span>
  </div>
);

export const DotsProgress: React.FC<{
  steps: string[];
  labels: string[];
  activeIndex: number;
  maxReachable: number;
  onDotClick: (index: number) => void;
}> = ({ steps, labels, activeIndex, maxReachable, onDotClick }) => (
  <div className="dots-bar">
    {steps.map((_, i) => {
      const isActive = i === activeIndex;
      const isDone = i <= maxReachable && !isActive;
      const isFuture = i > maxReachable;
      const className =
        "dot" +
        (isActive
          ? " dot-active"
          : isDone
            ? " dot-done"
            : isFuture
              ? " dot-future"
              : "");
      return (
        <button
          key={i}
          type="button"
          className={className}
          data-label={labels[i] || `Huésped ${i + 1}`}
          onClick={() => !isFuture && !isActive && onDotClick(i)}
          disabled={isFuture}
          tabIndex={-1}
        />
      );
    })}
  </div>
);

export const ConfirmBlock: React.FC<{
  title: string;
  rows: Array<[string, string | undefined | null]>;
  onEdit?: () => void;
}> = ({ title, rows, onEdit }) => (
  <div className="confirm-card">
    <div className="confirm-card-hdr">
      <span>{title}</span>
      {onEdit && (
        <button type="button" onClick={onEdit}>
          <Icon name="edit" size={12} /> Editar
        </button>
      )}
    </div>
    {rows
      .filter(([, v]) => Boolean(v))
      .map(([label, value]) => (
        <div className="confirm-row" key={label}>
          <span className="confirm-label">{label}</span>{" "}
          <span className="confirm-value">{value}</span>
        </div>
      ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════
// HEADER (CORREGIDO)
// ═══════════════════════════════════════════════════════════════════════════
export interface HeaderProps {
  canGoBack: boolean;
  onBack: () => void;
 rightAction?: { label: string; onClick: () => void; icon?: IconName; disabled?: boolean };
  extraContent?: React.ReactNode; // 👈 Nuevo Slot
  name?: string;
  room?: string;
}

export const Header: React.FC<HeaderProps> = ({
  canGoBack,
  onBack,
  rightAction,
  extraContent,
  name,
  room,
}) => (
  <div className="hdr">
    {/* Slot 1: Navegación */}
    <div className="hdr-side">
      {canGoBack ? (
        <button type="button" className="hdr-back" onClick={onBack}>
          <Icon name="left" size={15} /> Atrás
        </button>
      ) : (
        <div style={{ width: 62 }} />
      )}
    </div>

    {/* Slot 2: Brand (Centro) */}
    <div className="hdr-brand">
      <div className="hdr-logo">L</div>
      <div>
        <div className="hdr-name">{name || "Lumina"}</div>
        <div className="hdr-sub">{room || "Hotels & Resorts"}</div>
      </div>
    </div>

    {/* Slot 3: Acciones (Derecha) */}
    <div className="hdr-side hdr-actions-group">
      {extraContent} {/* 👈 Aquí irá el selector de idiomas */}
      {rightAction ? (
        <button
          type="button"
          className="hdr-action"
          onClick={rightAction.onClick}
        >
          {rightAction.icon && (
            <Icon name={rightAction.icon} size={14} color="#fff" />
          )}
        </button>
      ) : (
        !extraContent && <div style={{ width: 62 }} />
      )}
    </div>
  </div>
);

export const ReservationCard: React.FC<{ reserva: Reserva }> = ({
  reserva,
}) => (
  <div className="res-card">
    <div className="res-card-eyebrow">Su reserva</div>
    <div className="res-card-name">{reserva.habitacion}</div>
    <div className="res-card-row">
      <Icon name="calendar" size={13} /> {reserva.fechaEntrada} —{" "}
      {reserva.fechaSalida} · {reserva.numNoches} noches
    </div>
    <div className="res-card-row">
      <Icon name="bed" size={13} /> {reserva.numHuespedes}{" "}
      {reserva.numHuespedes === 1 ? "huésped" : "huéspedes"} ·{" "}
      {reserva.confirmacion}
    </div>
  </div>
);

export const LoadingSpinner: React.FC<{ text?: string }> = ({ text }) => (
  <div className="loading">
    <div className="spinner" /> {text && <p>{text}</p>}
  </div>
);
