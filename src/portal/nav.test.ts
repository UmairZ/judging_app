// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { NAVIGATE_EVENT, navigate, usePortalPath } from './nav';

beforeEach(() => {
  // jsdom's scrollTo is "not implemented" — stub it so path-change scrolling
  // is observable (and silent).
  window.scrollTo = vi.fn();
  window.history.replaceState({}, '', '/portal');
});

afterEach(cleanup);

describe('navigate', () => {
  it('pushes a history entry and dispatches the portal:navigate event', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const listener = vi.fn();
    window.addEventListener(NAVIGATE_EVENT, listener);

    navigate('/portal/org');

    expect(window.location.pathname).toBe('/portal/org');
    expect(pushSpy).toHaveBeenCalledWith({}, '', '/portal/org');
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(NAVIGATE_EVENT, listener);
  });

  it('is a no-op when the target path is already current — no duplicate history entry', () => {
    const pushSpy = vi.spyOn(window.history, 'pushState');
    const listener = vi.fn();
    window.addEventListener(NAVIGATE_EVENT, listener);

    navigate('/portal'); // beforeEach put us at /portal already

    expect(pushSpy).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe('/portal');

    window.removeEventListener(NAVIGATE_EVENT, listener);
  });
});

describe('usePortalPath', () => {
  it('returns the current pathname and re-renders on navigate()', () => {
    const { result } = renderHook(() => usePortalPath());
    expect(result.current).toBe('/portal');

    act(() => navigate('/portal/account'));
    expect(result.current).toBe('/portal/account');
  });

  it('re-renders on popstate (back/forward)', () => {
    const { result } = renderHook(() => usePortalPath());
    expect(result.current).toBe('/portal');

    // Simulate the browser restoring a history entry: the URL changes and a
    // popstate fires (jsdom's history.back() is async/flaky, so emulate it).
    act(() => {
      window.history.replaceState({}, '', '/portal/org');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(result.current).toBe('/portal/org');
  });

  it('keeps two consumers in sync', () => {
    const a = renderHook(() => usePortalPath());
    const b = renderHook(() => usePortalPath());

    act(() => navigate('/portal/c/2026/scoring'));

    expect(a.result.current).toBe('/portal/c/2026/scoring');
    expect(b.result.current).toBe('/portal/c/2026/scoring');
  });

  it('scrolls to the top on path change, but not on initial mount', () => {
    renderHook(() => usePortalPath());
    expect(window.scrollTo).not.toHaveBeenCalled();

    act(() => navigate('/portal/org'));
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });
});
