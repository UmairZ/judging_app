/* Portal preview route: the stock Catalyst demo shell (sidebar layout + home dashboard)
 * stood up verbatim on our stack. Content gets customized change-by-change from here. */
import '../marketing/oatmeal.css'
import { useEffect, useState } from 'react'
import { ApplicationLayout } from './ApplicationLayout'
import PortalHome from './PortalHome'
import { getEvents } from './demo-data'

type Events = Awaited<ReturnType<typeof getEvents>>

export default function PortalPage() {
  const [events, setEvents] = useState<Events>([])
  useEffect(() => {
    void getEvents().then(setEvents)
  }, [])

  return (
    // The demo puts these on <html>; here the route root carries them instead.
    <div className="min-h-screen bg-white font-sans text-zinc-950 antialiased lg:bg-zinc-100 dark:bg-zinc-900 dark:text-white dark:lg:bg-zinc-950">
      <ApplicationLayout events={events}>
        <PortalHome />
      </ApplicationLayout>
    </div>
  )
}
