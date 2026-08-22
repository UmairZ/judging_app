/** Pure, testable bits of admin-screen copy — kept out of the inline-styled JSX. */

/** "1 record" / "N records" (singular only at exactly 1). */
export function recordCountLabel(n: number): string {
  return `${n} record${n === 1 ? '' : 's'}`;
}

/** "N of M judges finished" — the leaderboard's judge-progress wording. */
export function judgesFinishedLabel(finalizedCount: number, panelSize: number): string {
  return `${finalizedCount} of ${panelSize} judges finished`;
}

/** Setup-strip step text: the circled-number glyph, or a check once the step's data exists. */
export function setupStepLabel(glyph: string, label: string, done: boolean): string {
  return `${done ? '✓' : glyph} ${label}`;
}
