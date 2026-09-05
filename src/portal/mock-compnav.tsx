/* THROWAWAY brainstorm mockups — two navigation patterns for competition admin
 * living inside the Catalyst portal. Registrations used as the dense test page. */
import { Badge } from './vendor/badge'
import { Button } from './vendor/button'
import { Heading } from './vendor/heading'
import { Input, InputGroup } from './vendor/input'
import { Navbar, NavbarItem, NavbarSection } from './vendor/navbar'
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from './vendor/sidebar'
import { SidebarLayout } from './vendor/sidebar-layout'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './vendor/table'
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/16/solid'
import {
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  DevicePhoneMobileIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  UserCircleIcon,
  UserGroupIcon,
  UsersIcon,
} from '@heroicons/react/20/solid'

const REGISTRATIONS = [
  { name: 'Aisha Siddiqua', category: "5 Ajzā' · Sisters", slot: 'S-01', status: 'Confirmed', color: 'lime' as const },
  { name: 'Fatima Noor', category: "5 Ajzā' · Sisters", slot: 'S-02', status: 'Confirmed', color: 'lime' as const },
  { name: 'Khadija Omar', category: "5 Ajzā' · Sisters", slot: 'S-03', status: 'Confirmed', color: 'lime' as const },
  { name: 'Yusuf al-Rashid', category: "1 Juz' · Brothers", slot: 'B-01', status: 'Confirmed', color: 'lime' as const },
  { name: 'Ibrahim Khan', category: "1 Juz' · Brothers", slot: '—', status: 'Pending slot', color: 'amber' as const },
  { name: 'Zayd Hassan', category: "15 Ajzā' · Combined", slot: 'C-04', status: 'Confirmed', color: 'lime' as const },
  { name: 'Maryam Ali', category: "1 Juz' · Sisters", slot: '—', status: 'Unpaid', color: 'red' as const },
]

export function RegistrationsContent() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading>Registrations</Heading>
        <div className="flex gap-3">
          <InputGroup>
            <MagnifyingGlassIcon />
            <Input name="search" placeholder="Search contestants&hellip;" />
          </InputGroup>
          <Button outline>Import CSV</Button>
          <Button>Add contestant</Button>
        </div>
      </div>
      <Table className="mt-8 [--gutter:--spacing(6)]">
        <TableHead>
          <TableRow>
            <TableHeader>Contestant</TableHeader>
            <TableHeader>Category</TableHeader>
            <TableHeader>Slot</TableHeader>
            <TableHeader className="text-right">Status</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {REGISTRATIONS.map((r) => (
            <TableRow key={r.name} href="#">
              <TableCell className="font-medium">{r.name}</TableCell>
              <TableCell className="text-zinc-500">{r.category}</TableCell>
              <TableCell className="text-zinc-500">{r.slot}</TableCell>
              <TableCell className="text-right">
                <Badge color={r.color}>{r.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}

/* Pattern A — contextual sidebar: entering a competition swaps the sidebar
 * to competition nav, with a back row to the portal. */
export function MockCompSidebar() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <SidebarLayout
        navbar={<Navbar />}
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <SidebarItem href="#">
                <ArrowLeftIcon />
                <SidebarLabel className="text-zinc-500">Ibn Katheer</SidebarLabel>
              </SidebarItem>
              <div className="flex items-center gap-2 px-2 pt-1 pb-2">
                <span className="text-base/6 font-semibold">2026 Ramadan Contest</span>
                <Badge color="lime">Live</Badge>
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
                  <SidebarLabel>Registrations</SidebarLabel>
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
                  <SidebarLabel>Judge devices</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
              <SidebarSpacer />
            </SidebarBody>
            <SidebarFooter className="max-lg:hidden">
              <div className="flex items-center gap-3 px-2 py-2.5">
                <UserCircleIcon className="size-8 text-zinc-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">Umair</span>
                  <span className="block truncate text-xs/5 text-zinc-500">umair@humsub.co</span>
                </span>
              </div>
            </SidebarFooter>
          </Sidebar>
        }
      >
        <RegistrationsContent />
      </SidebarLayout>
    </div>
  )
}

/* Pattern B — portal sidebar stays; competition renders as a page with a
 * header + tab strip (Navbar as tabs). */
export function MockCompTabs() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <SidebarLayout
        navbar={<Navbar />}
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-3 px-2 py-2.5">
                <span className="flex size-6 items-center justify-center rounded bg-zinc-950 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                  IK
                </span>
                <SidebarLabel>Ibn Katheer</SidebarLabel>
              </div>
            </SidebarHeader>
            <SidebarBody>
              <SidebarSection>
                <SidebarItem href="#">
                  <HomeIcon />
                  <SidebarLabel>Home</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <UserGroupIcon />
                  <SidebarLabel>Organization</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <UserCircleIcon />
                  <SidebarLabel>Account</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
              <SidebarSection>
                <SidebarHeading>Competitions</SidebarHeading>
                <SidebarItem href="#" current>
                  <SidebarLabel>2026 Ramadan Contest</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <SidebarLabel>2025 Ramadan Contest</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
              <SidebarSpacer />
            </SidebarBody>
            <SidebarFooter className="max-lg:hidden">
              <div className="flex items-center gap-3 px-2 py-2.5">
                <UserCircleIcon className="size-8 text-zinc-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">Umair</span>
                  <span className="block truncate text-xs/5 text-zinc-500">umair@humsub.co</span>
                </span>
              </div>
            </SidebarFooter>
          </Sidebar>
        }
      >
        <div className="flex items-center gap-3">
          <Heading>2026 Ramadan Contest</Heading>
          <Badge color="lime">Live</Badge>
        </div>
        <div className="mt-4 -mx-2 border-b border-zinc-950/10 dark:border-white/10">
          <Navbar>
            <NavbarSection>
              <NavbarItem href="#">Overview</NavbarItem>
              <NavbarItem href="#" current>
                Registrations
              </NavbarItem>
              <NavbarItem href="#">Panels &amp; judges</NavbarItem>
              <NavbarItem href="#">Questions</NavbarItem>
              <NavbarItem href="#">Scoring</NavbarItem>
              <NavbarItem href="#">Leaderboard</NavbarItem>
              <NavbarItem href="#">Judge devices</NavbarItem>
            </NavbarSection>
          </Navbar>
        </div>
        <div className="mt-8">
          <RegistrationsContent />
        </div>
      </SidebarLayout>
    </div>
  )
}
