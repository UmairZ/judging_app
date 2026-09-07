// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { DbProvider, InMemoryBackend } = await import('../data/backend');
const { TenantProvider } = await import('../tenant/TenantContext');
const { DEFAULT_SCORING_CONFIG } = await import('../scoring');
const { default: GradingScreen } = await import('./GradingScreen');

afterEach(cleanup);

function renderScreen(backend: InstanceType<typeof InMemoryBackend>, mistakeLimit: number) {
  return render(
    <DbProvider backend={backend}>
      <TenantProvider orgId="demo" compId="demo">
        <GradingScreen
          contestant={{ name: 'Test Kid', slotLabel: "1 Juz' · Brothers" }}
          enrollmentId="e1"
          judgeId="j1"
          minQuestions={3}
          mistakeLimit={mistakeLimit}
          meta={{ position: 1, total: 1, panelName: '', judgeIndex: 0, panelSize: 0, startedCount: 0 }}
          onEnd={() => {}}
        />
      </TenantProvider>
    </DbProvider>,
  );
}

describe('GradingScreen live config', () => {
  it('renders the tenant scoring weights, not the defaults', async () => {
    const backend = new InMemoryBackend();
    backend.seed('orgs/demo/competitions/demo/config/scoring', {
      ...DEFAULT_SCORING_CONFIG,
      weights: { hifz: 55, tajweed: 40, voice: 5 },
    });
    renderScreen(backend, 5);
    expect(await screen.findByText('Hifz · 55%')).toBeTruthy();
    expect(screen.getByText('Tajweed · 40%')).toBeTruthy();
  });
});

describe('count-based auto-flag', () => {
  it('prompts at the mistake limit, not before', async () => {
    const backend = new InMemoryBackend();
    renderScreen(backend, 2);
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(screen.queryByText('Call it?')).toBeNull();
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await screen.findByText('Call it?')).toBeTruthy();
    // limit language, not points language
    expect(screen.getByText(/2 hifz mistakes/)).toBeTruthy();
  });
});
