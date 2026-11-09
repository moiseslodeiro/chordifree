import type { ReactNode } from 'react';

interface ToolProps {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Cell of the top toolbar. Reproduces the Chordify pattern:
 * icon, uppercase label and the control or value below, all in a compact
 * row.
 */
export function Tool({ label, icon, children, className = '' }: ToolProps) {
  return (
    <div className={`tool ${className}`}>
      <span className="tool-head">
        <span className="tool-icon" aria-hidden="true">
          {icon}
        </span>
        <span className="tool-label">{label}</span>
      </span>
      <div className="tool-value">{children}</div>
    </div>
  );
}

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconNote() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  );
}

export function IconAccidental() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 4v16M14 4v16M5 9h14M5 15h14" />
    </svg>
  );
}

export function IconTranspose() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M8 20V4M5 7l3-3 3 3" />
      <path d="M16 4v16M13 17l3 3 3-3" />
    </svg>
  );
}

export function IconSliders() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

export function IconGuitar() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M15 3h6v6" />
      <path d="M14 4l6 6" />
      <path d="M12.5 9.5 9 13" />
      <path d="M9 13c-1.7-.6-3.4 0-4.4 1.2-1.3 1.5-.9 3.7.7 4.7 1.4.9 3.4.5 4.4-1 .7-1.1.7-2.4.3-3.4Z" />
    </svg>
  );
}

export function IconKey() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="8" cy="8" r="4" />
      <path d="m11 11 8 8M16 16l2-2M18 18l2-2" />
    </svg>
  );
}

export function IconClock() {
  return (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2" />
    </svg>
  );
}

export function IconCapo() {
  return (
    <svg {...ICON_PROPS}>
      <path d="M4 8h16M4 16h16" />
      <path d="M8 8v8M16 8v8" />
      <path d="M19 5v14" />
    </svg>
  );
}
