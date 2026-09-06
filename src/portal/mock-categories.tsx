/* THROWAWAY steering mockups — two layouts for a category-first Categories page
 * (divisions live INSIDE categories; no global divisions pool). Public behind
 * ?catmock=a|b, deleted once the operator picks. Static data, no backend. */
import { Badge } from './vendor/badge';
import { Button } from './vendor/button';
import { Divider } from './vendor/divider';
import { Field, Fieldset, Label } from './vendor/fieldset';
import { Heading, Subheading } from './vendor/heading';
import { Input } from './vendor/input';
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
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/16/solid';

const CATS = [
  { name: "1 Juz'", desc: '1 Juz (Ages 13 and Under)', minQ: 3, divisions: ['Brothers', 'Sisters'], slots: 2 },
  { name: "5 Ajzā'", desc: '5 Ajza (Ages 14-17)', minQ: 4, divisions: ['Brothers', 'Sisters'], slots: 2 },
  { name: "15 Ajzā'", desc: '15 Ajza (Open)', minQ: 5, divisions: ['Combined'], slots: 1 },
  { name: "30 Ajzā'", desc: '30 Ajza (Open)', minQ: 5, divisions: ['Combined'], slots: 1 },
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
          <SidebarItem href="#" current><Cog6ToothIcon /><SidebarLabel>Categories & Divisions</SidebarLabel></SidebarItem>
          <SidebarItem href="#"><UsersIcon /><SidebarLabel>Judges & Panels</SidebarLabel></SidebarItem>
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

/* Variant A — stacked category cards; divisions as removable chips inside each. */
export function MockCatCards() {
  return (
    <Shell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>Categories &amp; divisions</Heading>
          <Text className="mt-1">Each category holds its own divisions — 6 slots total.</Text>
        </div>
        <Button><PlusIcon /> Add category</Button>
      </div>
      <div className="mt-8 space-y-6">
        {CATS.map((c) => (
          <div key={c.name} className="rounded-xl border border-zinc-950/10 bg-white p-6">
            <div className="flex flex-wrap items-start gap-4">
              <Fieldset className="grid min-w-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
                <Field><Label>Category name</Label><Input defaultValue={c.name} /></Field>
                <Field><Label>Description (Zeffy label)</Label><Input defaultValue={c.desc} /></Field>
                <Field><Label>Min questions</Label><Input type="number" defaultValue={c.minQ} /></Field>
              </Fieldset>
              <Button plain className="mt-6 text-red-600">Remove</Button>
            </div>
            <Divider soft className="my-4" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm/6 font-medium text-zinc-500">Divisions:</span>
              {c.divisions.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-1 pr-1.5 pl-3 text-sm/6 font-medium">
                  {d}
                  <XMarkIcon className="size-4 cursor-pointer text-zinc-400 hover:text-red-600" />
                </span>
              ))}
              <Button outline className="!py-0.5 text-sm"><PlusIcon /> Add division</Button>
              <span className="ml-auto text-xs/6 text-zinc-400">{c.slots} slots</span>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}

/* Variant B — master-detail: category list left (like the contestant roster),
   selected category's fields + division rows right. */
export function MockCatMaster() {
  return (
    <Shell>
      <Heading>Categories &amp; divisions</Heading>
      <Text className="mt-1">Each category holds its own divisions — 6 slots total.</Text>
      <div className="mt-8 flex flex-wrap gap-8">
        <div className="w-64 shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm/6 text-zinc-500">4 categories</span>
            <Button className="!px-2.5 !py-1 text-sm"><PlusIcon /> New</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-zinc-950/10 bg-white">
            {CATS.map((c, i) => (
              <div key={c.name} className={'flex items-center justify-between px-4 py-3 ' + (i === 0 ? 'bg-zinc-100' : '') + (i > 0 ? ' border-t border-zinc-950/5' : '')}>
                <div>
                  <div className="text-sm/6 font-semibold">{c.name}</div>
                  <div className="text-xs/5 text-zinc-500">{c.divisions.length} division{c.divisions.length > 1 ? 's' : ''} · min {c.minQ} Q</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="min-w-0 flex-1 rounded-xl border border-zinc-950/10 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <Subheading>1 Juz'</Subheading>
            <Button plain className="text-red-600">Remove category</Button>
          </div>
          <Fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field><Label>Category name</Label><Input defaultValue="1 Juz'" /></Field>
            <Field><Label>Description (Zeffy label)</Label><Input defaultValue="1 Juz (Ages 13 and Under)" /></Field>
            <Field><Label>Min questions</Label><Input type="number" defaultValue={3} /></Field>
          </Fieldset>
          <Divider soft className="my-5" />
          <Subheading className="!text-sm">Divisions</Subheading>
          <div className="mt-2 divide-y divide-zinc-950/5">
            {['Brothers', 'Sisters'].map((d) => (
              <div key={d} className="flex items-center justify-between py-2.5">
                <span className="text-sm/6 font-medium">{d}</span>
                <Button plain className="text-red-600 !py-0.5 text-sm">Remove</Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <div className="max-w-48"><Input placeholder="Division name" /></div>
            <Button outline><PlusIcon /> Add division</Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}
