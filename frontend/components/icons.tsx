// Minimal inline icon set (stroke icons, 24px grid) — no icon dependency.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const ArrowUpRight = (p: P) => (<svg {...base} {...p}><path d="M7 17L17 7M8 7h9v9" /></svg>);
export const Arrow = (p: P) => (<svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const Shield = (p: P) => (<svg {...base} {...p}><path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" /><path d="M9 12l2 2 4-4" /></svg>);
export const Lock = (p: P) => (<svg {...base} {...p}><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 118 0v3" /></svg>);
export const Eye = (p: P) => (<svg {...base} {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>);
export const EyeOff = (p: P) => (<svg {...base} {...p}><path d="M3 3l18 18M10.6 5.1A10 10 0 0112 5c6.4 0 10 7 10 7a17 17 0 01-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 005.4-1.6" /><path d="M9.9 9.9a3 3 0 004.2 4.2" /></svg>);
export const Check = (p: P) => (<svg {...base} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const X = (p: P) => (<svg {...base} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const Sun = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>);
export const Moon = (p: P) => (<svg {...base} {...p}><path d="M20 14.5A8 8 0 019.5 4 8 8 0 1020 14.5z" /></svg>);
export const Github = (p: P) => (<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}><path d="M12 2a10 10 0 00-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.1-1.46-1.1-1.46-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 015 0c1.91-1.3 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0012 2z" /></svg>);
export const Menu = (p: P) => (<svg {...base} {...p}><path d="M4 7h16M4 12h16M4 17h16" /></svg>);
export const Upload = (p: P) => (<svg {...base} {...p}><path d="M12 15V3M7 8l5-5 5 5" /><path d="M20 15v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4" /></svg>);
export const Copy = (p: P) => (<svg {...base} {...p}><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>);
export const Download = (p: P) => (<svg {...base} {...p}><path d="M12 3v12M7 10l5 5 5-5" /><path d="M20 17v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2" /></svg>);
export const Repeat = (p: P) => (<svg {...base} {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 01-3 3H3" /></svg>);
export const Layers = (p: P) => (<svg {...base} {...p}><path d="M12 3l9 5-9 5-9-5 9-5z" /><path d="M3 13l9 5 9-5" /></svg>);
export const Cpu = (p: P) => (<svg {...base} {...p}><rect x="5" y="5" width="14" height="14" rx="2.5" /><rect x="9" y="9" width="6" height="6" rx="1" /><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" /></svg>);
export const Server = (p: P) => (<svg {...base} {...p}><rect x="3" y="4" width="18" height="7" rx="2" /><rect x="3" y="13" width="18" height="7" rx="2" /><path d="M7 7.5h.01M7 16.5h.01" /></svg>);
export const Link = (p: P) => (<svg {...base} {...p}><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" /></svg>);
export const Info = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5h.01" /></svg>);
export const Alert = (p: P) => (<svg {...base} {...p}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v4M12 17.5h.01" /></svg>);
export const File = (p: P) => (<svg {...base} {...p}><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" /><path d="M14 3v5h5" /></svg>);
export const Sparkle = (p: P) => (<svg {...base} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" /><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7L19 16z" /></svg>);
export const User = (p: P) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>);
export const Calendar = (p: P) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>);
export const Pin = (p: P) => (<svg {...base} {...p}><path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>);
export const Hash = (p: P) => (<svg {...base} {...p}><path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18" /></svg>);

/** 24-spoke Ashoka Chakra mark. */
export function Chakra(p: P) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" aria-hidden {...p}>
      <circle cx="50" cy="50" r="44" strokeWidth="4" />
      <circle cx="50" cy="50" r="7" fill="currentColor" stroke="none" />
      {spokes.map((deg) => (
        <line key={deg} x1="50" y1="50" x2="50" y2="9" strokeWidth="1.8" transform={`rotate(${deg} 50 50)`} />
      ))}
    </svg>
  );
}

/** Brand mark: an ink tile with a saffron gate arch and a green "proof" dot. */
export function BrandMark(p: P) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden {...p}>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="currentColor" />
      <path d="M9.5 24V13.5a6.5 6.5 0 0113 0V24" fill="none" stroke="#FF7A1A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="16" cy="18" r="2.8" fill="#2CC466" />
    </svg>
  );
}
