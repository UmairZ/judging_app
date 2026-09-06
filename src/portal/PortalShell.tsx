import React from 'react';
import { SidebarLayout } from './vendor/sidebar-layout';
import { Navbar } from './vendor/navbar';
import './theme.css';

export function PortalShell({
  sidebar,
  children,
}: React.PropsWithChildren<{ sidebar: React.ReactNode }>) {
  // THROWAWAY styling experiment switch (?style=1|2|3) — operator steering only;
  // the chosen variant graduates into theme.css defaults and this param goes away.
  // Sticky per-tab: client-side navigation drops the query string, so remember the
  // last explicit choice in sessionStorage (?style=0 resets to stock).
  const param = new URLSearchParams(window.location.search).get('style');
  if (param !== null) {
    try {
      if (param === '0') sessionStorage.removeItem('portal-style');
      else sessionStorage.setItem('portal-style', param);
    } catch { /* storage unavailable — param still applies for this render */ }
  }
  let stored: string | null = null;
  try { stored = sessionStorage.getItem('portal-style'); } catch { /* ignore */ }
  const styleVariant = (param === '0' ? undefined : param ?? stored) ?? undefined;
  return (
    <div
      data-portal
      data-style={styleVariant}
      className="min-h-screen bg-zinc-100 font-sans text-zinc-950 antialiased"
    >
      <SidebarLayout navbar={<Navbar />} sidebar={<div className="portal-sb contents">{sidebar}</div>}>
        {children}
      </SidebarLayout>
    </div>
  );
}
