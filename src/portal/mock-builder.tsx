/* THROWAWAY brainstorm mockups — Approach 1 (focused wizard) vs Approach 2
 * (draft-mode portal), composed from vendored Catalyst components. */
import { Badge } from './vendor/badge'
import { Button } from './vendor/button'
import { Divider } from './vendor/divider'
import { Heading, Subheading } from './vendor/heading'
import { Input } from './vendor/input'
import { Link } from './vendor/link'
import { Select } from './vendor/select'
import { Navbar, NavbarItem, NavbarSection, NavbarSpacer } from './vendor/navbar'
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
import { Text } from './vendor/text'
import {
  Cog6ToothIcon,
  HomeIcon,
  QuestionMarkCircleIcon,
  TrashIcon,
  UserCircleIcon,
} from '@heroicons/react/20/solid'
import { PlusIcon, RocketLaunchIcon } from '@heroicons/react/16/solid'

const DRAFT_CATEGORIES = [
  { level: '1 Juz', division: 'Brothers', minQ: 3 },
  { level: '1 Juz', division: 'Sisters', minQ: 3 },
  { level: '5 Ajza', division: 'Combined', minQ: 4 },
  { level: '15 Ajza', division: 'Combined', minQ: 5 },
]

/* ---------------- Approach 1: focused wizard ---------------- */

function StepDot({ n, label, state }: { n: number; label: string; state: 'done' | 'current' | 'todo' }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={
          'flex size-6 items-center justify-center rounded-full text-xs font-semibold ' +
          (state === 'done'
            ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
            : state === 'current'
              ? 'border-2 border-zinc-950 text-zinc-950 dark:border-white dark:text-white'
              : 'border border-zinc-300 text-zinc-400 dark:border-zinc-600')
        }
      >
        {state === 'done' ? '✓' : n}
      </span>
      <span
        className={
          'text-sm/6 ' +
          (state === 'current' ? 'font-semibold text-zinc-950 dark:text-white' : 'text-zinc-500')
        }
      >
        {label}
      </span>
    </div>
  )
}

export function MockWizard() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-100 font-sans text-zinc-950 antialiased dark:bg-zinc-950 dark:text-white">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold">Ubayy.</span>
        <span className="text-xs/6 text-zinc-500">Draft saved on this device — nothing sent anywhere yet</span>
      </div>
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 pb-16">
        <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <div className="flex items-center gap-6">
            <StepDot n={1} label="Names" state="done" />
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            <StepDot n={2} label="Categories" state="current" />
            <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-700" />
            <StepDot n={3} label="Go live" state="todo" />
          </div>

          <Heading className="mt-8">Categories</Heading>
          <Text className="mt-2">
            Each category is a memorization level and who competes in it. Contestants register into a
            category; judges grade at least the minimum questions.
          </Text>

          <div className="mt-6">
            {DRAFT_CATEGORIES.map((c, i) => (
              <div key={i}>
                <Divider soft={i > 0} />
                <div className="flex items-center gap-3 py-3">
                  <div className="w-32">
                    <Select defaultValue={c.level} name={`level-${i}`}>
                      <option>1 Juz</option>
                      <option>5 Ajza</option>
                      <option>15 Ajza</option>
                      <option>30 Ajza</option>
                    </Select>
                  </div>
                  <div className="w-36">
                    <Select defaultValue={c.division} name={`division-${i}`}>
                      <option>Brothers</option>
                      <option>Sisters</option>
                      <option>Combined</option>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm/6 text-zinc-500">min questions</span>
                    <div className="w-16">
                      <Input type="number" defaultValue={c.minQ} name={`minq-${i}`} />
                    </div>
                  </div>
                  <button className="ml-auto text-zinc-400 hover:text-red-600" aria-label="Remove category">
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </div>
            ))}
            <Divider soft />
            <button className="mt-3 flex items-center gap-1.5 text-sm/6 font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400">
              <PlusIcon className="size-4" /> Add category
            </button>
          </div>

          <div className="mt-8 flex items-center justify-between">
            <Button plain>← Back</Button>
            <Button>
              Continue <RocketLaunchIcon />
            </Button>
          </div>
        </div>
        <p className="mt-4 text-center text-xs/6 text-zinc-500">
          Step 3 asks you to create an account (invite required) — your draft goes live exactly as configured.
        </p>
      </div>
    </div>
  )
}

/* ---------------- Approach 2: draft-mode portal ---------------- */

export function MockDraftPortal() {
  return (
    <div className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection>
              <NavbarItem href="#">Sign in</NavbarItem>
            </NavbarSection>
          </Navbar>
        }
        sidebar={
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-3 px-2 py-2.5">
                <span className="flex size-6 items-center justify-center rounded bg-zinc-950 text-xs font-bold text-white dark:bg-white dark:text-zinc-950">
                  N
                </span>
                <SidebarLabel>Noor Academy</SidebarLabel>
                <Badge color="amber">Draft</Badge>
              </div>
            </SidebarHeader>
            <SidebarBody>
              <SidebarSection>
                <SidebarItem href="#" current>
                  <HomeIcon />
                  <SidebarLabel>Home</SidebarLabel>
                </SidebarItem>
                <SidebarItem href="#">
                  <Cog6ToothIcon />
                  <SidebarLabel>Organization settings</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
              <SidebarSpacer />
              <SidebarSection>
                <SidebarItem href="#">
                  <QuestionMarkCircleIcon />
                  <SidebarLabel>Support</SidebarLabel>
                </SidebarItem>
              </SidebarSection>
            </SidebarBody>
            <SidebarFooter className="max-lg:hidden">
              <div className="flex items-center gap-3 px-2 py-2.5">
                <UserCircleIcon className="size-8 text-zinc-400" />
                <span className="min-w-0">
                  <span className="block truncate text-sm/5 font-medium text-zinc-950 dark:text-white">Guest</span>
                  <span className="block truncate text-xs/5 text-zinc-500">Not signed in</span>
                </span>
              </div>
            </SidebarFooter>
          </Sidebar>
        }
      >
        <div className="mb-8 flex items-center justify-between gap-4 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-600/20 dark:bg-amber-400/10">
          <Text className="!text-amber-900 dark:!text-amber-200">
            This is a draft stored on this device. Create an account to take it live — everything you
            configure here carries over.
          </Text>
          <Button color="amber">
            Go live <RocketLaunchIcon />
          </Button>
        </div>

        <Heading>Good afternoon</Heading>
        <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
          <Subheading>Competitions</Subheading>
          <Button outline>New competition</Button>
        </div>
        <div className="mt-4">
          <Divider />
          <div className="flex items-center justify-between">
            <div className="flex gap-6 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                2027
              </div>
              <div className="space-y-1.5">
                <div className="text-base/6 font-semibold">
                  <Link href="#">2027 Spring Hifz Contest</Link>
                </div>
                <div className="text-xs/6 text-zinc-500">Draft — stored on this device</div>
                <div className="text-xs/6 text-zinc-600">4 categories configured · nothing live yet</div>
              </div>
            </div>
            <Badge color="amber">Draft</Badge>
          </div>
          <Divider soft />
        </div>
      </SidebarLayout>
    </div>
  )
}
