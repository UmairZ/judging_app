// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const { PortalShell } = await import('./PortalShell');

// Vitest doesn't run with `globals: true`, so @testing-library/react's automatic
// afterEach(cleanup) never registers — unmount explicitly between tests.
afterEach(cleanup);

describe('PortalShell', () => {
  it('renders children and has data-portal attribute', () => {
    const testSidebar = <div>Test Sidebar</div>;
    const testChild = 'Test Child Content';

    render(
      <PortalShell sidebar={testSidebar}>
        {testChild}
      </PortalShell>
    );

    expect(screen.getByText(testChild)).toBeTruthy();
    const portalElement = screen.getByText(testChild).closest('[data-portal]');
    expect(portalElement).toBeTruthy();
  });
});
