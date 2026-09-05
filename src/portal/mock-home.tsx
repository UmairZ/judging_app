/* THROWAWAY brainstorm mockups — two candidate portal-home layouts composed from
 * vendored Catalyst components. Deleted once the operator picks a direction. */
import { Badge } from './vendor/badge'
import { Button } from './vendor/button'
import { Divider } from './vendor/divider'
import { Dropdown, DropdownButton, DropdownItem, DropdownMenu } from './vendor/dropdown'
import { Heading, Subheading } from './vendor/heading'
import { Link } from './vendor/link'
import { EllipsisVerticalIcon } from '@heroicons/react/16/solid'
import { Stat } from './stat'

const COMPETITIONS = [
  {
    id: '2026',
    name: '2026 Ramadan Contest',
    meta: 'Sat, Mar 14 2026 · Ibn Katheer Masjid',
    counts: '148 contestants · 12 judges · 6 categories',
    status: 'Live',
    color: 'lime' as const,
  },
  {
    id: '2027',
    name: '2027 Winter Qualifier',
    meta: 'Draft — not scheduled yet',
    counts: '4 categories configured',
    status: 'Setup',
    color: 'blue' as const,
  },
  {
    id: '2025',
    name: '2025 Ramadan Contest',
    meta: 'Ended Mar 22, 2025',
    counts: '121 contestants · 10 judges · 6 categories',
    status: 'Archived',
    color: 'zinc' as const,
  },
]

function CompetitionList() {
  return (
    <ul>
      {COMPETITIONS.map((comp, index) => (
        <li key={comp.id}>
          <Divider soft={index > 0} />
          <div className="flex items-center justify-between">
            <div className="flex gap-6 py-6">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-zinc-100 font-semibold text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                {comp.id}
              </div>
              <div className="space-y-1.5">
                <div className="text-base/6 font-semibold">
                  <Link href="#">{comp.name}</Link>
                </div>
                <div className="text-xs/6 text-zinc-500">{comp.meta}</div>
                <div className="text-xs/6 text-zinc-600">{comp.counts}</div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="max-sm:hidden" color={comp.color}>
                {comp.status}
              </Badge>
              <Dropdown>
                <DropdownButton plain aria-label="More options">
                  <EllipsisVerticalIcon />
                </DropdownButton>
                <DropdownMenu anchor="bottom end">
                  <DropdownItem>Open</DropdownItem>
                  <DropdownItem>Rename</DropdownItem>
                  <DropdownItem>Archive</DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Variant A — competitions ARE the home page. */
export function MockHomeA() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading>Good afternoon, Umair</Heading>
        <Button>New competition</Button>
      </div>
      <div className="mt-10">
        <CompetitionList />
      </div>
    </>
  )
}

/** Variant B — stat row for the active competition above the same list. */
export function MockHomeB() {
  return (
    <>
      <Heading>Good afternoon, Umair</Heading>
      <div className="mt-8 flex items-end justify-between">
        <Subheading>2026 Ramadan Contest — live</Subheading>
      </div>
      <div className="mt-4 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <Stat title="Registrations" value="148" change="+12%" />
        <Stat title="Sessions graded" value="312" change="+38%" />
        <Stat title="Judges active" value="12" change="+2%" />
        <Stat title="Categories" value="6" change="+0%" />
      </div>
      <div className="mt-14 flex flex-wrap items-end justify-between gap-4">
        <Subheading>Competitions</Subheading>
        <Button>New competition</Button>
      </div>
      <div className="mt-4">
        <CompetitionList />
      </div>
    </>
  )
}
