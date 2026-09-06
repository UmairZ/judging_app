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

  it('sidebar node sits inside .portal-sb', () => {
    const testSidebar = <div data-testid="sidebar-content">Sidebar</div>;

    render(
      <PortalShell sidebar={testSidebar}>
        Content
      </PortalShell>
    );

    const sidebarNode = screen.getByTestId('sidebar-content');
    const portalSbAncestor = sidebarNode.closest('.portal-sb');
    expect(portalSbAncestor).toBeTruthy();
  });

  it('navbar in children does not sit inside .portal-sb', () => {
    const testSidebar = <div>Sidebar</div>;

    render(
      <PortalShell sidebar={testSidebar}>
        <nav data-testid="content-nav">Content Navigation</nav>
      </PortalShell>
    );

    const contentNav = screen.getByTestId('content-nav');
    const portalSbAncestor = contentNav.closest('.portal-sb');
    expect(portalSbAncestor).toBeNull();
  });
});
