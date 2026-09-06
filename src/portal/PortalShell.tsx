import React from 'react';
import { SidebarLayout } from './vendor/sidebar-layout';
import { Navbar } from './vendor/navbar';
import './theme.css';

export function PortalShell({
  sidebar,
  children,
}: React.PropsWithChildren<{ sidebar: React.ReactNode }>) {
  return (
    <div data-portal className="min-h-screen font-sans text-zinc-950 antialiased">
      <SidebarLayout navbar={<Navbar />} sidebar={<div className="portal-sb contents">{sidebar}</div>}>
        {children}
      </SidebarLayout>
    </div>
  );
}
