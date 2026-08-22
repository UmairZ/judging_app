/** Thin section divider: hairline with a small eight-fold star at center. */
export default function StarDivider() {
  return (
    <div className="my-4 flex items-center gap-4" aria-hidden>
      <div className="h-px flex-1 bg-olive-200" />
      <svg width="18" height="18" viewBox="0 0 18 18" className="text-brass-500">
        <rect x="4" y="4" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.1" />
        <rect x="4" y="4" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.1" transform="rotate(45 9 9)" />
      </svg>
      <div className="h-px flex-1 bg-olive-200" />
    </div>
  );
}
