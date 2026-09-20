// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';

vi.mock('../firebase/app', () => ({ app: {}, db: {}, auth: { currentUser: null } }));

const { InMemoryBackend, DbProvider } = await import('../data/backend');
const { TenantProvider } = await import('../tenant/TenantContext');
const { default: Projector } = await import('./Projector');

afterEach(cleanup);

/** Three contestants in the default '1'/'brothers' slot, scored so the natural
 * (score) order is Amina > Bilal > Carim. */
function seeded() {
  const b = new InMemoryBackend();
  const base = 'orgs/ik/competitions/2026';
  const q = (voice: number, events: { type: string }[] = []) => [{ index: 0, events, voice, disqualified: false }];
  b.seed(`${base}/contestants/c1`, { fullName: 'Amina Noor', active: true });
  b.seed(`${base}/contestants/c2`, { fullName: 'Bilal Omar', active: true });
  b.seed(`${base}/contestants/c3`, { fullName: 'Carim Said', active: true });
  for (const [cid, voice, ev] of [['c1', 5, []], ['c2', 4, [{ type: 'prompted' }]], ['c3', 2, [{ type: 'prompted_failed' }]]] as const) {
    b.seed(`${base}/enrollments/${cid}_1`, { contestantId: cid, category: '1', division: 'brothers', round: 'main' });
    b.seed(`${base}/sessions/${cid}_1__j1`, { enrollmentId: `${cid}_1`, judgeId: 'j1', questions: q(voice, [...ev]), finalizedAt: 1 });
  }
  return b;
}

const view = (backend: InstanceType<typeof InMemoryBackend>) =>
  render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="ik" compId="2026">
        <Projector />
      </TenantProvider>
    </DbProvider>,
  );

/** Reveal all three placements: the board enters a slot hidden and steps 3rd→2nd→1st. */
function revealAll() {
  for (let i = 0; i < 3; i++) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
}

describe('Projector ranking', () => {
  it('ranks by score when no tie-break is recorded', async () => {
    view(seeded());
    revealAll();
    expect(await screen.findByText('Amina Noor')).toBeTruthy();
    const first = screen.getByText('1').closest('div')!;
    expect(within(first).getByText('Amina Noor')).toBeTruthy();
  });

  it('honours an admin placement override (Adjust placements) over the score order', async () => {
    const b = seeded();
    // admin drags Carim to first, then Amina, then Bilal
    b.seed('orgs/ik/competitions/2026/tiebreaks/1_brothers', {
      category: '1', division: 'brothers', method: 'override',
      contestantIds: ['c3', 'c1', 'c2'], resolution: { order: ['c3', 'c1', 'c2'] },
      resolvedBy: 'admin', note: '', createdAt: 1,
    });
    view(b);
    revealAll();
    expect(await screen.findByText('Carim Said')).toBeTruthy();
    // #1 card carries the overridden winner, not the top scorer
    const first = screen.getByText('1').closest('div')!;
    expect(within(first).getByText('Carim Said')).toBeTruthy();
    expect(within(first).queryByText('Amina Noor')).toBeNull();
  });
});
