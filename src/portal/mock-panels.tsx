/* THROWAWAY steering mockups — two layouts for the Judges page's "Panels &
 * assignment" section (current table is hard to follow). Echoes the OLD app's
 * StructurePanels visual language — color-coded panels, tap-to-toggle
 * membership and slots — in Catalyst chrome. Public behind ?jpmock=a|b,
 * deleted once the operator picks. Static data, no backend. */
import { Badge } from './vendor/badge';
import { Button } from './vendor/button';
import { Divider } from './vendor/divider';
import { Heading, Subheading } from './vendor/heading';
import { Input } from './vendor/input';
import { Switch } from './vendor/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './vendor/table';
import { Text } from './vendor/text';
import { Navbar } from './vendor/navbar';
import {
  Sidebar, SidebarBody, SidebarHeader, SidebarItem, SidebarLabel, SidebarSection, SidebarSpacer,
} from './vendor/sidebar';
import { SidebarLayout } from './vendor/sidebar-layout';
import {
  ChartBarIcon, ClipboardDocumentListIcon, Cog6ToothIcon, DevicePhoneMobileIcon,
  HomeIcon, QuestionMarkCircleIcon, UsersIcon,
} from '@heroicons/react/20/solid';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/16/solid';

const JUDGES = ['Ustadha Huda', 'Maryam', 'Sara', 'Zaynab'];

const SLOTS = [
  { category: "1 Juz'", division: 'Brothers' },
  { category: "1 Juz'", division: 'Sisters' },
  { category: "5 Ajzā'", division: 'Brothers' },
  { category: "5 Ajzā'", division: 'Sisters' },
  { category: "15 Ajzā'", division: 'Combined' },
  { category: "30 Ajzā'", division: 'Combined' },
];
const slotLabel = (s: { category: string; division: string }) => `${s.category} · ${s.division}`;

// Per-panel color, echoing the old StructurePanels panelColor() cycle —
// Badge color for chips plus tailwind classes for accents and member pills.
const PANELS = [
  {
    name: "Sisters' Panel",
    badge: 'lime' as const,
    bar: 'border-l-lime-500',
    memberPill: 'border-lime-500 bg-lime-50 text-lime-950',
    judges: ['Ustadha Huda', 'Maryam', 'Sara', 'Zaynab'],
    slots: ["1 Juz' · Sisters", "5 Ajzā' · Sisters", "15 Ajzā' · Combined", "30 Ajzā' · Combined"],
  },
  {
    name: "Brothers' Panel",
    badge: 'blue' as const,
    bar: 'border-l-blue-500',
    memberPill: 'border-blue-500 bg-blue-50 text-blue-950',
    judges: ['Maryam', 'Sara'],
    slots: ["1 Juz' · Brothers", "5 Ajzā' · Brothers"],
  },
];

function MockSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarItem href="#"><ArrowLeftIcon /><SidebarLabel className="text-zinc-500">Demo Masjid</SidebarLabel></SidebarItem>
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <span className="text-base/6 font-semibold">2026 Ramadan Contest</span>
          <Badge color="lime">Live</Badge>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="#"><HomeIcon /><SidebarLabel>Overview</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><ClipboardDocumentListIcon /><SidebarLabel>Contestants</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><Cog6ToothIcon /><SidebarLabel>Categories & Divisions</SidebarLabel></SidebarItem>
          <SidebarItem href="#" current><UsersIcon /><SidebarLabel>Judges & Panels</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><QuestionMarkCircleIcon /><SidebarLabel>Scoring</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><ChartBarIcon /><SidebarLabel>Leaderboard</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><DevicePhoneMobileIcon /><SidebarLabel>Provisioning</SidebarLabel></SidebarItem>
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
    </Sidebar>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div data-portal className="min-h-screen font-sans text-zinc-950 antialiased">
      <SidebarLayout navbar={<Navbar />} sidebar={<div className="portal-sb contents"><MockSidebar /></div>}>
        {children}
      </SidebarLayout>
    </div>
  );
}

/* Compact sketch of the real page's roster section — context only; the mock's
   focus is the panels below it. */
function RosterSketch() {
  return (
    <div className="mt-8">
      <Subheading>Judges</Subheading>
      <div className="mt-3 divide-y divide-zinc-950/5 rounded-xl border border-zinc-950/10 bg-white px-4">
        {JUDGES.map((name) => (
          <div key={name} className="flex items-center justify-between py-2.5">
            <span className="text-sm/6 font-medium">{name}</span>
            <Switch checked disabled />
          </div>
        ))}
      </div>
    </div>
  );
}

function JudgePills({ panel }: { panel: (typeof PANELS)[number] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {JUDGES.map((name) => {
        const member = panel.judges.includes(name);
        return (
          <span
            key={name}
            className={
              'inline-flex cursor-pointer items-center rounded-lg border px-3 py-1.5 text-sm/6 font-medium ' +
              (member ? panel.memberPill : 'border-dashed border-zinc-950/15 bg-transparent text-zinc-400')
            }
            title={member ? 'Tap to remove from panel' : 'Tap to add to panel'}
          >
            {name}
          </span>
        );
      })}
    </div>
  );
}

function SlotPills({ panel }: { panel: (typeof PANELS)[number] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SLOTS.map((s) => {
        const label = slotLabel(s);
        const assigned = panel.slots.includes(label);
        return assigned ? (
          <Badge key={label} color={panel.badge} className="cursor-pointer !px-3 !py-1.5 !text-sm/6">
            ✓ {label}
          </Badge>
        ) : (
          <span
            key={label}
            className="inline-flex cursor-pointer items-center rounded-lg border border-dashed border-zinc-950/15 px-3 py-1.5 text-sm/6 font-medium text-zinc-400"
            title="Tap to assign to this panel"
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

/* Variant A — one card per panel, stacked. Colored left bar + Badge carry the
   panel's identity; membership and slots are tap-to-toggle pill rows. */
export function MockPanelsCards() {
  return (
    <Shell>
      <Heading>Judges &amp; panels</Heading>
      <Text className="mt-2">The roster — group them into panels below, and pick what each panel scores.</Text>

      <RosterSketch />

      <Divider className="my-8" />

      <Subheading>Panels</Subheading>
      <Text className="mt-1">Each card is a panel — its judges, and the slots it scores.</Text>

      <div className="mt-4 space-y-6">
        {PANELS.map((panel) => (
          <div key={panel.name} className={'rounded-xl border border-zinc-950/10 border-l-4 bg-white p-6 ' + panel.bar}>
            <div className="flex flex-wrap items-center gap-3">
              <Badge color={panel.badge}>{panel.judges.length} {panel.judges.length === 1 ? 'judge' : 'judges'}</Badge>
              <div className="max-w-56 min-w-0 flex-1"><Input defaultValue={panel.name} /></div>
              <Button plain className="ml-auto text-red-600">Delete panel</Button>
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase">Judges</div>
              <JudgePills panel={panel} />
            </div>

            <div className="mt-5">
              <div className="mb-2 text-xs/5 font-semibold tracking-wide text-zinc-500 uppercase">Scores these slots</div>
              <SlotPills panel={panel} />
            </div>
          </div>
        ))}
      </div>

      <Button outline className="mt-4"><PlusIcon /> Add panel</Button>
    </Shell>
  );
}

/* Variant B — refined matrix: panel rows × slot columns, colored check chips
   for assignments; membership edited in a strip below for the selected panel. */
export function MockPanelsGrid() {
  const selected = PANELS[0];
  return (
    <Shell>
      <Heading>Judges &amp; panels</Heading>
      <Text className="mt-2">The roster — group them into panels below, and pick what each panel scores.</Text>

      <RosterSketch />

      <Divider className="my-8" />

      <Subheading>Panels</Subheading>
      <Text className="mt-1">One row per panel — tap a cell to give that panel the slot.</Text>

      <Table className="mt-4 [--gutter:--spacing(6)]">
        <TableHead>
          <TableRow>
            <TableHeader>Panel</TableHeader>
            {SLOTS.map((s) => (
              <TableHeader key={slotLabel(s)}>
                <span className="block leading-tight">{s.category}</span>
                <span className="block text-xs/5 font-normal text-zinc-500">{s.division}</span>
              </TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {PANELS.map((panel) => (
            <TableRow key={panel.name}>
              <TableCell>
                <Badge color={panel.badge}>{panel.name}</Badge>
                <span className="mt-1 block text-xs/5 text-zinc-500">
                  {panel.judges.length} {panel.judges.length === 1 ? 'judge' : 'judges'}
                </span>
              </TableCell>
              {SLOTS.map((s) => {
                const assigned = panel.slots.includes(slotLabel(s));
                return (
                  <TableCell key={slotLabel(s)}>
                    {assigned ? (
                      <Badge color={panel.badge} className="cursor-pointer !px-2.5" title="Tap to unassign">✓</Badge>
                    ) : (
                      <span className="cursor-pointer text-zinc-300" title="Tap to assign">—</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className={'mt-6 rounded-xl border border-zinc-950/10 border-l-4 bg-white p-6 ' + selected.bar}>
        <div className="flex items-center gap-3">
          <Subheading className="!text-sm">Panel membership</Subheading>
          <Badge color={selected.badge}>{selected.name}</Badge>
        </div>
        <Text className="mt-1 text-sm">Tap a judge to add or remove them from the selected panel.</Text>
        <div className="mt-3">
          <JudgePills panel={selected} />
        </div>
      </div>

      <Button outline className="mt-4"><PlusIcon /> Add panel</Button>
    </Shell>
  );
}

/* Variant C (operator hybrid) — Judges roster and Panel membership side by side
   up top; the panels × slots assignment matrix below. Matrix panel rows act as
   the membership selector. */
export function MockPanelsHybrid() {
  const selected = PANELS[0];
  return (
    <Shell>
      <Heading>Judges &amp; panels</Heading>
      <Text className="mt-2">The roster — group them into panels below, and pick what each panel scores.</Text>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <Subheading>Judges</Subheading>
          <div className="mt-3 divide-y divide-zinc-950/5 rounded-xl border border-zinc-950/10 bg-white px-4">
            {JUDGES.map((name) => (
              <div key={name} className="flex items-center justify-between py-2.5">
                <span className="text-sm/6 font-medium">{name}</span>
                <Switch checked disabled />
              </div>
            ))}
          </div>
          <Button outline className="mt-3 !py-1 text-sm"><PlusIcon /> Add judge</Button>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <Subheading>Panel membership</Subheading>
            <Badge color={selected.badge}>{selected.name}</Badge>
          </div>
          <div className={'mt-3 rounded-xl border border-zinc-950/10 border-l-4 bg-white p-5 ' + selected.bar}>
            <Text className="text-sm">Tap a judge to add or remove them — select a panel in the table below.</Text>
            <div className="mt-3">
              <JudgePills panel={selected} />
            </div>
          </div>
        </div>
      </div>

      <Divider className="my-8" />

      <Subheading>Panels × slots</Subheading>
      <Text className="mt-1">One row per panel — tap a cell to give that panel the slot; tap the panel name to edit its membership above.</Text>
      <Table className="mt-4 [--gutter:--spacing(6)]">
        <TableHead>
          <TableRow>
            <TableHeader>Panel</TableHeader>
            {SLOTS.map((s) => (
              <TableHeader key={slotLabel(s)}>
                <span className="block leading-tight">{s.category}</span>
                <span className="block text-xs/5 font-normal text-zinc-500">{s.division}</span>
              </TableHeader>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {PANELS.map((panel, i) => (
            <TableRow key={panel.name} className={i === 0 ? 'bg-zinc-950/[.03]' : ''}>
              <TableCell>
                <Badge color={panel.badge} className="cursor-pointer">{panel.name}</Badge>
                <span className="mt-1 block text-xs/5 text-zinc-500">
                  {panel.judges.length} {panel.judges.length === 1 ? 'judge' : 'judges'}
                </span>
              </TableCell>
              {SLOTS.map((s) => {
                const assigned = panel.slots.includes(slotLabel(s));
                return (
                  <TableCell key={slotLabel(s)}>
                    {assigned ? (
                      <Badge color={panel.badge} className="cursor-pointer !px-2.5" title="Tap to unassign">✓</Badge>
                    ) : (
                      <span className="cursor-pointer text-zinc-300" title="Tap to assign">—</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button outline className="mt-4"><PlusIcon /> Add panel</Button>
    </Shell>
  );
}
