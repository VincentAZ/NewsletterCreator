import { useEffect, useId, useRef, type ReactNode } from "react";
import type { DesktopApi } from "@newsletter/core";

declare global {
  interface Window {
    newsletter: DesktopApi;
  }
}
export const api = window.newsletter;

const paths = {
  library: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  studio: "M4 20h4L20 8l-4-4L4 16v4 M14 6l4 4",
  settings: "M4 7h16 M4 17h16 M8 4v6 M16 14v6",
  sources: "M4 3h12l4 4v14H4z M8 11h8 M8 15h8 M8 7h4",
  preview:
    "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  plus: "M12 5v14 M5 12h14",
  close: "M6 6l12 12 M18 6 6 18",
  up: "M6 14l6-6 6 6",
  down: "M6 10l6 6 6-6",
  copy: "M8 8h12v13H8z M16 8V3H3v13h5",
  undo: "M8 4 3 9l5 5 M3 9h11a6 6 0 0 1 0 12",
  image: "M3 3h18v18H3z M3 17l6-6 4 4 3-3 5 5 M16 7h.01",
  edit: "M12 3v6 M9 6h6 M5 15v6 M2 18h6 M18 10v8 M14 14h8",
  arrow: "M4 12h16 M14 6l6 6-6 6",
} as const;
export function Icon({
  name,
  size = 18,
}: {
  name: keyof typeof paths;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  type?: string;
}) {
  const fieldId = useId();
  return (
    <label className="field" htmlFor={fieldId}>
      <span id={`${fieldId}-label`}>{label}</span>
      {multiline ? (
        <textarea
          id={fieldId}
          aria-labelledby={`${fieldId}-label`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      ) : (
        <input
          id={fieldId}
          aria-labelledby={`${fieldId}-label`}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}
    </label>
  );
}
export function Empty({
  title,
  body,
  action,
  label,
}: {
  title: string;
  body: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <Icon name="studio" size={32} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action && (
        <button className="primary" onClick={action}>
          {label}
        </button>
      )}
    </div>
  );
}

export function Dialog({
  title,
  children,
  close,
  className = "",
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header className="dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={close}
        >
          <Icon name="close" />
        </button>
      </header>
      {children}
    </dialog>
  );
}
