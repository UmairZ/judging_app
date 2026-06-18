import { describe, it, expect } from 'vitest';
import { canAccess, resolveLanding } from './access';

describe('canAccess', () => {
  it('admin can reach every area (incl. judge view for on-device re-entry)', () => {
    expect(canAccess('admin', 'admin')).toBe(true);
    expect(canAccess('admin', 'judge')).toBe(true);
    expect(canAccess('admin', 'display')).toBe(true);
  });
  it('judge is confined to the judge area', () => {
    expect(canAccess('judge', 'judge')).toBe(true);
    expect(canAccess('judge', 'admin')).toBe(false);
    expect(canAccess('judge', 'display')).toBe(false);
  });
  it('display is confined to the display area', () => {
    expect(canAccess('display', 'display')).toBe(true);
    expect(canAccess('display', 'admin')).toBe(false);
    expect(canAccess('display', 'judge')).toBe(false);
  });
  it('an unauthenticated device can reach nothing', () => {
    expect(canAccess(null, 'admin')).toBe(false);
    expect(canAccess(null, 'judge')).toBe(false);
  });
});

describe('resolveLanding', () => {
  it('sends each role to its landing', () => {
    expect(resolveLanding('admin')).toBe('admin-home');
    expect(resolveLanding('judge')).toBe('judge-welcome');
    expect(resolveLanding('display')).toBe('display');
  });
  it('sends an unprovisioned device to the admin login (to provision the seat)', () => {
    expect(resolveLanding(null)).toBe('admin-login');
  });
});
