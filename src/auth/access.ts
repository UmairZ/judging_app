import type { Role } from './claims';

export type Area = 'admin' | 'judge' | 'display';

export function canAccess(role: Role | null, area: Area): boolean {
  if (role === 'admin') return true; // admin reaches everything
  return role === area; // judge→judge, display→display, null→nothing
}

export function resolveLanding(role: Role | null): 'admin-home' | 'judge-welcome' | 'display' | 'admin-login' {
  switch (role) {
    case 'admin':
      return 'admin-home';
    case 'judge':
      return 'judge-welcome';
    case 'display':
      return 'display';
    default:
      return 'admin-login';
  }
}
