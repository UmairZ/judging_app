import type { ComponentType, ReactNode, SVGProps } from 'react';
import { ArrowLeftIcon } from '@heroicons/react/16/solid';
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  RectangleGroupIcon,
  UsersIcon,
} from '@heroicons/react/20/solid';
import { useDocData } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { compBasePath } from '../../tenant/paths';
import { AccountFooter } from '../AccountFooter';
import { STATUS_LABEL, statusColor, type CompStatus } from '../lifecycle';
import { compPath, type CompSection } from '../routes';
import { PortalShell } from '../PortalShell';
import { Badge } from '../vendor/badge';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '../vendor/sidebar';

interface OrgDoc {
  name: string;
}

interface CompDoc {
  name: string;
  status: CompStatus;
}

const SECTIONS: { section: CompSection; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { section: 'overview', label: 'Overview', icon: HomeIcon },
  { section: 'contestants', label: 'Contestants', icon: ClipboardDocumentListIcon },
  { section: 'categories', label: 'Categories & Divisions', icon: RectangleGroupIcon },
  { section: 'judges', label: 'Judges & Panels', icon: UsersIcon },
  { section: 'scoring', label: 'Scoring', icon: Cog6ToothIcon },
  { section: 'leaderboard', label: 'Leaderboard', icon: ChartBarIcon },
  { section: 'provisioning', label: 'Provisioning', icon: DevicePhoneMobileIcon },
];

/**
 * Contextual sidebar for a single competition: swaps in for the org sidebar
 * once inside `/portal/c/{compId}`. Both the org name (back-item) and the
 * competition name/status come from live doc subscriptions — orgId/compId are
 * always real here, provided by the enclosing TenantProvider (Task 4's rule:
 * never build a path from a missing id).
 */
export function CompShell({
  compId,
  section,
  children,
}: {
  compId: string;
  section: CompSection;
  children: ReactNode;
}) {
  const { orgId } = useTenant();
  const org = useDocData<OrgDoc>(`orgs/${orgId}`);
  const comp = useDocData<CompDoc>(compBasePath(orgId, compId));

  const sidebar = (
    <Sidebar>
      <SidebarHeader>
        <SidebarItem href="/portal">
          <ArrowLeftIcon />
          <SidebarLabel className="text-zinc-500">{org.data?.name ?? '…'}</SidebarLabel>
        </SidebarItem>
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <span className="truncate text-base/6 font-semibold">{comp.data?.name ?? '…'}</span>
          {comp.data && <Badge color={statusColor(comp.data.status)}>{STATUS_LABEL[comp.data.status] ?? comp.data.status}</Badge>}
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          {SECTIONS.map(({ section: s, label, icon: Icon }) => (
            <SidebarItem key={s} href={compPath(compId, s)} current={s === section}>
              <Icon />
              <SidebarLabel>{label}</SidebarLabel>
            </SidebarItem>
          ))}
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
      <AccountFooter />
    </Sidebar>
  );

  return <PortalShell sidebar={sidebar}>{children}</PortalShell>;
}
