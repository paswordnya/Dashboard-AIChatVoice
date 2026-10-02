// Minimal hand-drawn stroke icons (no icon-library dependency) — 24x24
// viewBox, currentColor stroke, used only for the sidebar nav and a
// handful of stat cards. Purely decorative; swap freely without touching
// any data/logic.

type IconProps = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconMic({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <line x1="12" y1="18" x2="12" y2="21.5" />
      <line x1="8.5" y1="21.5" x2="15.5" y2="21.5" />
    </svg>
  );
}

export function IconGrid({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconCpu({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" />
      <line x1="12" y1="2" x2="12" y2="5" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="2" y1="12" x2="5" y2="12" />
      <line x1="19" y1="12" x2="22" y2="12" />
    </svg>
  );
}

export function IconShuffle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <polyline points="17 3 21 3 21 7" />
      <line x1="3" y1="21" x2="21" y2="3" />
      <polyline points="17 21 21 21 21 17" />
      <line x1="3" y1="3" x2="9.5" y2="9.5" />
      <line x1="14.5" y1="14.5" x2="21" y2="21" />
    </svg>
  );
}

export function IconDatabase({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <ellipse cx="12" cy="5.5" rx="7.5" ry="3" />
      <path d="M4.5 5.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
      <path d="M4.5 11.5v6c0 1.66 3.36 3 7.5 3s7.5-1.34 7.5-3v-6" />
    </svg>
  );
}

export function IconTag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M11.5 3.5h-5A3 3 0 0 0 3.5 6.5v5a2 2 0 0 0 .59 1.41l8 8a2 2 0 0 0 2.82 0l6-6a2 2 0 0 0 0-2.82l-8-8a2 2 0 0 0-1.41-.59Z" />
      <circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconHash({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <line x1="9" y1="3.5" x2="6.5" y2="20.5" />
      <line x1="17.5" y1="3.5" x2="15" y2="20.5" />
      <line x1="4" y1="9" x2="20" y2="9" />
      <line x1="3" y1="15" x2="19" y2="15" />
    </svg>
  );
}

export function IconUsers({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M2.75 20c0-3.45 2.8-6 6.25-6s6.25 2.55 6.25 6" />
      <circle cx="17" cy="8.5" r="2.5" />
      <path d="M15 5.2a2.5 2.5 0 0 1 3.9 3" />
      <path d="M21.25 20c0-2.9-2-5.2-4.75-5.85" />
    </svg>
  );
}

export function IconDollar({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M14.8 9.3c0-1.27-1.25-2.3-2.8-2.3s-2.8 1.03-2.8 2.3S10.65 11.6 12 11.6s2.8 1.03 2.8 2.3-1.25 2.3-2.8 2.3-2.8-1.03-2.8-2.3" />
      <line x1="12" y1="5.5" x2="12" y2="18.5" />
    </svg>
  );
}

export function IconTrendingUp({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <polyline points="3 17 9.5 10.5 14 15 21 6.5" />
      <polyline points="14.5 6 21 6.5 20.5 13" />
    </svg>
  );
}

export function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9.25" />
      <polyline points="12 7 12 12 15.5 14" />
    </svg>
  );
}

export function IconActivity({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <polyline points="2.5 13 7 13 9 8 13.5 18 16 13 21.5 13" />
    </svg>
  );
}

export function IconArrowUpCircle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9.25" />
      <polyline points="8.5 12.5 12 9 15.5 12.5" />
      <line x1="12" y1="9.2" x2="12" y2="16" />
    </svg>
  );
}

export function IconHelpCircle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="9.25" />
      <path d="M9.3 9.3a2.7 2.7 0 1 1 3.9 2.4c-.85.47-1.2 1-1.2 1.9" />
      <circle cx="12" cy="16.7" r="0.15" fill="currentColor" />
    </svg>
  );
}

export function IconAlertTriangle({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <path d="M12 3.5 22 20.5H2Z" />
      <line x1="12" y1="9.5" x2="12" y2="14" />
      <circle cx="12" cy="17.2" r="0.15" fill="currentColor" />
    </svg>
  );
}

export function IconSliders({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="9" cy="6" r="2" fill="white" />
      <circle cx="16" cy="12" r="2" fill="white" />
      <circle cx="8" cy="18" r="2" fill="white" />
    </svg>
  );
}

export function IconSettings({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <circle cx="12" cy="12" r="3.25" />
      <path d="M12 3.5v2.3M12 18.2v2.3M20.5 12h-2.3M5.8 12H3.5M17.8 6.2l-1.6 1.6M7.8 16.2l-1.6 1.6M17.8 17.8l-1.6-1.6M7.8 7.8 6.2 6.2" />
    </svg>
  );
}

export function IconSmartphone({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <line x1="10.5" y1="18" x2="13.5" y2="18" />
    </svg>
  );
}

export function IconChevronDown({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} {...base}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconLogo({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" stroke="none">
      <rect x="3" y="3" width="8" height="8" rx="2.5" />
      <rect x="13" y="3" width="8" height="8" rx="2.5" opacity="0.45" />
      <rect x="3" y="13" width="8" height="8" rx="2.5" opacity="0.45" />
      <rect x="13" y="13" width="8" height="8" rx="2.5" />
    </svg>
  );
}
