import React from 'react';
import { SidebarLayout } from './vendor/sidebar-layout';
import { Navbar } from './vendor/navbar';
import './theme.css';

export function PortalShell({
  sidebar,
  children,
}: React.PropsWithChildren<{ sidebar: React.ReactNode }>) {
  return (
    <div data-portal className="min-h-screen bg-zinc-100 font-sans text-zinc-950 antialiased">
      <div className="portal-sb contents">
        <SidebarLayout navbar={<Navbar />} sidebar={sidebar}>
          {children}
        </SidebarLayout>
      </div>
    </div>
  );
}
