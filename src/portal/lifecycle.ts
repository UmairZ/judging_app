import { writeDoc } from '../data/db';

export type CompStatus = 'setup' | 'live' | 'archived';

/**
 * Write a competition's lifecycle status. `write` defaults to the real
 * Firestore `writeDoc`; tests pass a recording stub instead.
 */
export function setStatus(
  write: typeof writeDoc = writeDoc,
  orgId: string,
  compId: string,
  status: CompStatus,
): Promise<void> {
  return write(`orgs/${orgId}/competitions/${compId}`, { status });
}

/** Badge color for a competition's lifecycle status. */
export function statusColor(status: string): 'blue' | 'lime' | 'zinc' {
  if (status === 'live') return 'lime';
  if (status === 'setup') return 'blue';
  return 'zinc';
}

/** Human label for a competition's lifecycle status badge. */
export const STATUS_LABEL: Record<CompStatus, string> = {
  setup: 'Setup',
  live: 'Live',
  archived: 'Archived',
};

/** Greeting bucket for the current (or given) time. */
export function timeOfDay(date: Date = new Date()): 'morning' | 'afternoon' | 'evening' {
  const hour = date.getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
