/* THROWAWAY brandstorm mockups — the SAME Pattern-A registrations screen with the
 * competition identity (green #206560/#16413B, gold #DCB75E, brass #9C7C34) applied
 * as COLOR ONLY. No spacing, type, or radius changes — Catalyst stays Catalyst. */
import { Badge } from './vendor/badge'
import { Navbar } from './vendor/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from './vendor/sidebar'
import { SidebarLayout } from './vendor/sidebar-layout'
import { ArrowLeftIcon } from '@heroicons/react/16/solid'
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'
import { RegistrationsContent } from './mock-compnav'

function CompSidebar() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarItem href="#">
          <ArrowLeftIcon />
          <SidebarLabel className="text-zinc-500">Ibn Katheer</SidebarLabel>
        </SidebarItem>
        <div className="flex items-center gap-2 px-2 pt-1 pb-2">
          <span className="text-base/6 font-semibold">2026 Ramadan Contest</span>
          <Badge className="bg-[#F6EFDA]! text-[#9C7C34]!">Live</Badge>
        </div>
      </SidebarHeader>
      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="#">
            <HomeIcon />
            <SidebarLabel>Overview</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#" current>
            <ClipboardDocumentListIcon />
            <SidebarLabel>Contestants</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#">
            <UsersIcon />
            <SidebarLabel>Panels &amp; judges</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#">
            <QuestionMarkCircleIcon />
            <SidebarLabel>Questions</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#">
            <Cog6ToothIcon />
            <SidebarLabel>Scoring</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#">
            <ChartBarIcon />
            <SidebarLabel>Leaderboard</SidebarLabel>
          </SidebarItem>
          <SidebarItem href="#">
            <DevicePhoneMobileIcon />
            <SidebarLabel>Provisioning</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
        <SidebarSpacer />
      </SidebarBody>
      <SidebarFooter className="max-lg:hidden">
        <div className="flex items-center gap-3 px-2 py-2.5">
          <UserCircleIcon className="size-8 text-zinc-400" />
          <span className="min-w-0">
            <span className="block truncate text-sm/5 font-medium">Umair</span>
            <span className="block truncate text-xs/5 text-zinc-500">umair@humsub.co</span>
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}

function Shell({ variant }: { variant: 'ink' | 'deep' }) {
  return (
    <div
      data-brand={variant}
      className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100"
    >
      <style>{`
        /* color-only overrides; identical selectors either way */
        [data-brand] main a[href="#"]:hover { color: inherit; }
        /* current-item marker + label -> deep green */
        [data-brand='ink'] nav span.relative > span.absolute { background: #206560 !important; }
        [data-brand='ink'] nav a[data-current], [data-brand='ink'] nav button[data-current] { color: #16413B !important; }
        [data-brand='ink'] nav a[data-current] svg, [data-brand='ink'] nav button[data-current] svg { fill: #206560 !important; }
        /* primary buttons -> green (solid Catalyst buttons read --btn-bg; outline/plain don't) */
        [data-brand] main button { --btn-bg: #206560; --btn-border: #185049; --btn-hover-overlay: rgba(255,255,255,0.08); }

        /* deep: the whole sidebar wears the competition green */
        [data-brand='deep'] { --sb-ink: #DCEAE6; }
        [data-brand='deep'] .brand-sb-wrap nav { background: #16413B; }
        [data-brand='deep'] .brand-sb-wrap nav a, [data-brand='deep'] .brand-sb-wrap nav span { color: var(--sb-ink) !important; }
        [data-brand='deep'] .brand-sb-wrap nav svg { fill: #8FB5AA !important; }
        [data-brand='deep'] .brand-sb-wrap nav a[data-current] { color: #DCB75E !important; }
        [data-brand='deep'] .brand-sb-wrap nav a[data-current] svg { fill: #DCB75E !important; }
        [data-brand='deep'] .brand-sb-wrap nav span.relative > span.absolute { background: #DCB75E !important; }
        [data-brand='deep'] .brand-sb-wrap nav a:hover { background: rgba(255,255,255,.06) !important; }
        [data-brand='deep'] .brand-sb-wrap nav .text-zinc-500 { color: #9DBDB4 !important; }
        [data-brand='deep'] .brand-sb-wrap nav .text-zinc-400 { color: #9DBDB4 !important; }
      `}</style>
      <div className="brand-sb-wrap contents">
        <SidebarLayout navbar={<Navbar />} sidebar={<CompSidebar />}>
          <RegistrationsContent />
        </SidebarLayout>
      </div>
    </div>
  )
}

/** Variant 1 — "ink accents": Catalyst stays light zinc; green replaces black as the
 * accent (current nav item, primary buttons); gold only in status chips. */
export function MockBrandInk() {
  return <Shell variant="ink" />
}

/** Variant 2 — "deep sidebar": the sidebar wears competition green with gold current
 * item (echoing the judge screens); content area stays stock light Catalyst. */
export function MockBrandDeep() {
  return <Shell variant="deep" />
}
