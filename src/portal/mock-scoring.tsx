/* THROWAWAY steering mockup — the Scoring page rewritten in judge-mirroring
 * plain language (no engine jargon: no hifz_base, no component bases, no
 * "spread + DQ trigger"). Public behind ?scmock=1, deleted once the operator
 * signs off. Static data, no backend. */
import { Badge } from './vendor/badge';
import { Button } from './vendor/button';
import { Divider } from './vendor/divider';
import { Field, Fieldset, Label } from './vendor/fieldset';
import { Heading, Subheading } from './vendor/heading';
import { Input } from './vendor/input';
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
import { ArrowLeftIcon } from '@heroicons/react/16/solid';

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
          <SidebarItem href="#"><UsersIcon /><SidebarLabel>Judges & Panels</SidebarLabel></SidebarItem>
          <SidebarItem href="#" current><QuestionMarkCircleIcon /><SidebarLabel>Scoring</SidebarLabel></SidebarItem>
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

/* In-portal explainer card — neutral zinc styling (deliberately NOT the
   judge-world cream of ProvisioningPage's boundary card; this must read as
   portal chrome). Title + short paragraphs. */
function ExplainerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-6">
      <Text className="font-semibold text-zinc-900">{title}</Text>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

/* Static radio-card — a styled div with a radio dot (vendor radio.tsx is a
   bare dot control; the whole-card selection styling lives here). */
function RadioCard({
  selected, disabled, title, badge, children,
}: { selected?: boolean; disabled?: boolean; title: string; badge?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className={
        'flex-1 rounded-xl border p-5 ' +
        (selected
          ? 'border-zinc-950/25 bg-white ring-2 ring-zinc-950/10'
          : 'border-zinc-950/10 bg-white') +
        (disabled ? ' opacity-60' : ' cursor-pointer')
      }
    >
      <div className="flex items-center gap-3">
        <span
          className={
            'flex size-4.5 flex-none items-center justify-center rounded-full border ' +
            (selected ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-950/20 bg-white')
          }
        >
          {selected && <span className="size-1.5 rounded-full bg-white" />}
        </span>
        <span className="text-sm/6 font-semibold">{title}</span>
        {badge}
      </div>
      <Text className="mt-2 text-sm">{children}</Text>
    </div>
  );
}

const MISTAKES = [
  { label: 'Self-corrected', judge: 'caught and fixed it themselves', cost: '0 points' },
  { label: 'Prompted', judge: 'needed a hint', cost: '1 point' },
  { label: 'Prompted-failed', judge: 'hint given, still stuck', cost: '2 points' },
  { label: 'Tajweed major', judge: 'a clear recitation error', cost: '1 point' },
  { label: 'Tajweed minor', judge: 'a small slip in recitation', cost: '½ point' },
];

export function MockScoring() {
  return (
    <Shell>
      <Heading>Scoring</Heading>
      <Text className="mt-2">Changes take effect immediately — scores recompute everywhere automatically.</Text>

      <div className="mt-8">
        <ExplainerCard title="How scoring works">
          <Text className="text-sm">
            Judges tap a button for each mistake they hear. Every contestant starts at 100; each
            mistake takes points off, weighted by how much each component counts.
          </Text>
          <Text className="text-sm">
            The scoring system below controls exactly how much each mistake costs.
          </Text>
        </ExplainerCard>
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>Scoring system</Subheading>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <RadioCard selected title="Standard deductions">
            Each mistake costs a fixed amount. Simple and predictable — the system used by Ibn
            Katheer since 2025.
          </RadioCard>
          <RadioCard disabled title="Escalating penalties" badge={<Badge color="zinc">Coming soon</Badge>}>
            Repeated mistakes in the same question cost progressively more, spreading scores across
            skill levels.
          </RadioCard>
        </div>
      </div>

      <Divider className="my-8" />

      <div>
        <div className="flex items-baseline gap-3">
          <Subheading>What each part is worth</Subheading>
          <Badge color="green">= 100 ✓</Badge>
        </div>
        <Text className="mt-1">Out of the 100 points a contestant starts with.</Text>
        <Fieldset className="mt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field>
              <Label>Hifz — memorization</Label>
              <Input type="number" min={0} max={100} defaultValue={70} />
            </Field>
            <Field>
              <Label>Tajweed — recitation</Label>
              <Input type="number" min={0} max={100} defaultValue={25} />
            </Field>
            <Field>
              <Label>Voice &amp; delivery</Label>
              <Input type="number" min={0} max={100} defaultValue={5} />
            </Field>
          </div>
        </Fieldset>
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>What each mistake costs</Subheading>
        <Text className="mt-1">The same buttons the judge sees, and what each one takes off.</Text>
        <Table className="mt-4 [--gutter:--spacing(6)]">
          <TableHead>
            <TableRow>
              <TableHeader>Judge&apos;s button</TableHeader>
              <TableHeader>Meaning</TableHeader>
              <TableHeader className="text-right">Cost</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {MISTAKES.map((m) => (
              <TableRow key={m.label}>
                <TableCell className="font-medium">{m.label}</TableCell>
                <TableCell className="text-zinc-500">{m.judge}</TableCell>
                <TableCell className="text-right">{m.cost}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Text className="mt-3 text-sm text-zinc-500">
          Costs come off a 10-point rail inside each component, then weighted — e.g. one Prompted
          mistake ≈ 7 off the final 100.
        </Text>
      </div>

      <Divider className="my-8" />

      <div>
        <Subheading>Disqualification trigger</Subheading>
        <Text className="mt-1">
          When a question&apos;s memorization points hit zero, the judge is asked whether to write
          off the whole question.
        </Text>
        <Fieldset className="mt-4">
          <Field className="max-w-40">
            <Label>Memorization points per question</Label>
            <Input type="number" min={1} max={20} defaultValue={10} />
          </Field>
        </Fieldset>
      </div>

      <Divider className="my-8" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <Text>Scores recompute everywhere automatically — settings are read live by all views.</Text>
        <Button>Save</Button>
      </div>
    </Shell>
  );
}
