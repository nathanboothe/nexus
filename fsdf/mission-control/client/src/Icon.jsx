// Icon.jsx — minimal inline SVG icons keyed by name. Stroke uses
// currentColor so CSS controls the color.

const PATHS = {
  thermo: <path d="M10 13.5V4a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </>
  ),
  camera: (
    <>
      <path d="M3 8h3l2-2h8l2 2h3v11H3z" />
      <circle cx="12" cy="13" r="3.5" />
    </>
  ),
  sofa: (
    <>
      <path d="M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3" />
      <path d="M2 12a2 2 0 0 1 4 0v4h12v-4a2 2 0 0 1 4 0v6H2z" />
    </>
  ),
  kitchen: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="1" />
      <path d="M9 3v6M5 9h14" />
    </>
  ),
  stairs: <path d="M3 20h4v-4h4v-4h4V8h4V4" />,
  bed: (
    <>
      <path d="M3 8v11M3 13h18v6M21 13v-2a3 3 0 0 0-3-3H8" />
      <circle cx="6.5" cy="10.5" r="1.5" />
    </>
  ),
  home: <path d="M3 11l9-7 9 7M5 10v10h14V10" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
    </>
  ),
};

export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name] ?? PATHS.home}
    </svg>
  );
}
