/** Shared design tokens for the Ibn Katheer design language (teal + brass, cream surfaces). */
export const C = {
  ink: '#1C2926',
  green: '#206560',
  greenDeep: '#16413B',
  greenPress: '#185049',
  brass: '#B99644',
  brassDark: '#9C7C34',
  gold: '#DCB75E',
  canvas: '#E3DDD0',
  parchment: '#F4EFE4',
  cream: '#FBF8F1',
  line: '#EAE3D4',
  cardLine: '#E6DEC9',
  muted: '#8A938E',
  sub: '#5C6661',
  fail: '#C0563C',
  failBg: '#FBEEEA',
  failLine: '#E6CCC2',
  pill: '#F6EFDA',
  pillGreen: '#DCEAE6',
  hifzBar: '#C99A3A',
  tajBar: '#4E78AE',
  voiceBar: '#5E9B86',
  sisters: '#7E6BA0',
} as const;

export const serif = "'Spectral', serif";
export const arabic = "'El Messiri', sans-serif";

/** Whole number → "8", fractional → "8.5". */
export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
/** 0..1 fraction → "85%". */
export const pct = (f: number) => `${Math.round(f * 100)}%`;
/** "Aisha Siddiqua" → "AS" */
export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
