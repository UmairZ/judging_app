/* Portal preview route: the stock Catalyst demo shell (sidebar layout + home dashboard)
 * stood up verbatim on our stack. Content gets customized change-by-change from here. */
import '../marketing/oatmeal.css'
import { useEffect, useState } from 'react'
import { ApplicationLayout } from './ApplicationLayout'
import PortalHome from './PortalHome'
import { MockHomeA, MockHomeB } from './mock-home'
import { MockWizard, MockDraftPortal } from './mock-builder'
import { MockCompSidebar, MockCompTabs } from './mock-compnav'
import { MockBrandInk, MockBrandDeep } from './mock-brand'
import { getEvents } from './demo-data'

type Events = Awaited<ReturnType<typeof getEvents>>

export default function PortalPage() {
  const [events, setEvents] = useState<Events>([])
  useEffect(() => {
    void getEvents().then(setEvents)
  }, [])

  // THROWAWAY: approach mockups render without the stock shell.
  const mock = new URLSearchParams(window.location.search).get('builder')
  if (mock === '1') return <MockWizard />
  if (mock === '2') return <MockDraftPortal />
  const compnav = new URLSearchParams(window.location.search).get('compnav')
  if (compnav === 'a') return <MockCompSidebar />
  if (compnav === 'b') return <MockCompTabs />
  const brand = new URLSearchParams(window.location.search).get('brand')
  if (brand === '1') return <MockBrandInk />
  if (brand === '2') return <MockBrandDeep />

  return (
    // The demo puts these on <html>; here the route root carries them instead.
    <div className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <ApplicationLayout events={events}>
        {/* THROWAWAY: ?home=a|b renders the brainstorm mockups; default stays stock. */}
        {new URLSearchParams(window.location.search).get('home') === 'a' ? (
          <MockHomeA />
        ) : new URLSearchParams(window.location.search).get('home') === 'b' ? (
          <MockHomeB />
        ) : (
          <PortalHome />
        )}
      </ApplicationLayout>
    </div>
  )
}
