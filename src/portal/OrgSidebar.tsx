import { HomeIcon, UserCircleIcon, UserGroupIcon } from '@heroicons/react/20/solid';
import { AccountFooter } from './AccountFooter';
import { usePortalPath } from './nav';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from './vendor/sidebar';

/** `orgName` is null for a signed-in account with no org bound yet (e.g. a
 * judge account) — the sidebar (and critically its Sign out) still renders,
 * just with the product name standing in for an org. */
export function OrgSidebar({ orgName }: { orgName: string | null }) {
  // Reactive path (same source PortalRoot routes from) so the current-item
  // highlight tracks client-side navigations, not just full loads.
  const pathname = usePortalPath();
  const headerLabel = orgName ?? 'Ubayy';
  const initial = headerLabel.charAt(0).toUpperCase();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
            {initial}
          </div>
          <span className="truncate text-sm/5 font-medium text-zinc-950 dark:text-white">{headerLabel}</span>
        </div>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="/portal" current={pathname === '/portal'}>
            <HomeIcon />
            <SidebarLabel>Home</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/portal/org" current={pathname === '/portal/org'}>
            <UserGroupIcon />
            <SidebarLabel>Organization</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="/portal/account" current={pathname === '/portal/account'}>
            <UserCircleIcon />
            <SidebarLabel>Account</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>

      <AccountFooter />
    </Sidebar>
  );
}
