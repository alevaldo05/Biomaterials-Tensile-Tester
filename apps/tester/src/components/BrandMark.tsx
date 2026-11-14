/* The app's logo (the "curve mark"): a stress-strain curve on axes whose peak rises into two cat ears, with two small
   eyes, in a rounded square. Drawn for this project. The square takes the theme's accent color and the lines its
   accent ink, so it reads in light and dark. Decorative: the app name is written beside it. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 64 64">
      <rect x="2" y="2" width="60" height="60" rx="13" fill="var(--accent)" />
      <g fill="none" stroke="var(--accent-ink)" strokeLinecap="round" strokeLinejoin="round">
        <path strokeWidth="2.4" d="M12 12V52H52" />
        <path strokeWidth="4" d="M13 51C18 50.5 20 48 21.5 43L25.5 15L31 25H36L41.5 15L45 30L48 51" />
      </g>
      <circle cx="30" cy="33" r="1.9" fill="var(--accent-ink)" />
      <circle cx="37" cy="33" r="1.9" fill="var(--accent-ink)" />
    </svg>
  );
}
