// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';

// GradingScreen (via ../data/db and ../firebase/app) initializes a real Firebase
// app at import time, which needs env config this test environment doesn't have.
// The demo path never touches `db`/`auth` (InMemoryBackend + seam-aware hooks), so
// a bare mock keeps the import safe — same pattern as src/data/backend.test.ts.
vi.mock('../firebase/app', () => ({ db: {}, auth: { currentUser: null } }));

const { default: DemoGrading } = await import('./DemoGrading');

// Vitest doesn't run with `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) never registers — unmount explicitly between tests.
afterEach(cleanup);

describe('DemoGrading', () => {
  it('renders the real grading screen with the demo contestant', async () => {
    render(<DemoGrading />);
    expect(await screen.findByText(/Yusuf al-Rashid/)).toBeTruthy();
    expect(screen.getByText(/nothing is saved/i)).toBeTruthy();
  });

  it('records a deduction without touching Firestore', async () => {
    render(<DemoGrading />);
    // Find the "Prompted" stepper card and tap its "+" — GradingScreen's real DOM has
    // no test ids, so scope by walking up from the label to the card container
    // (label span -> row div -> flex:1 div -> card div), matching StepperCard's
    // actual markup (src/judge/GradingScreen.tsx's StepperCard component).
    const label = await screen.findByText('Prompted');
    const card = label.parentElement!.parentElement!.parentElement as HTMLElement;
    expect(within(card).getByText('0')).toBeTruthy();
    fireEvent.click(within(card).getByTitle('Add one'));
    expect(await within(card).findByText('1')).toBeTruthy();
  });
});
