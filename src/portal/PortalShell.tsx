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
  const styleVariant = new URLSearchParams(window.location.search).get('style') ?? undefined;
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
