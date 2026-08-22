import { C, serif } from './theme';

/** The Ubayy wordmark: Spectral 700, brass "yy". Works on light and dark grounds. */
export default function Wordmark({ size = 22, onDark = false }: { size?: number; onDark?: boolean }) {
  return (
    <span style={{ fontFamily: serif, fontWeight: 700, fontSize: size, letterSpacing: '0.01em', color: onDark ? C.cream : C.ink, lineHeight: 1 }}>
      Uba<span style={{ color: onDark ? C.gold : C.brass }}>yy</span>
    </span>
  );
}
