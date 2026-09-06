/* Tailwind Plus 'Catalyst' component, adapted under the Tailwind Plus license for this application.
 * Not for redistribution as a component library. https://tailwindcss.com/plus/license */
/**
 * TODO: Update this component to use your client-side framework's link
 * component. We've provided examples of how to do this for Next.js, Remix, and
 * Inertia.js in the Catalyst documentation:
 *
 * https://catalyst.tailwindui.com/docs#client-side-router-integration
 *
 * Done for this app: integrated with src/portal/nav.ts's history-based router
 * per the Catalyst client-side-router integration docs above — portal-internal
 * links navigate in place; everything else keeps native anchor behavior.
 */

import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { navigate } from '../nav'

/** Exact '/portal' or a '/portal/...' subpath only — a bare startsWith would
 * also claim paths like '/portalfoo' (mirrors App.tsx's gate). */
function isPortalHref(href: string) {
  return href === '/portal' || href.startsWith('/portal/')
}

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    // Run any caller-supplied handler first (e.g. Headless's CloseButton
    // close) — it may legitimately preventDefault to opt out below.
    props.onClick?.(event)
    if (
      isPortalHref(props.href) && // client-routable; judge-world + external links stay native
      event.button === 0 && // plain left-click only
      !event.metaKey &&
      !event.ctrlKey &&
      !event.shiftKey &&
      !event.altKey && // modified clicks (open-in-new-tab etc.) stay native
      !props.target && // target=_blank etc. stays native
      props.download === undefined && // download links stay native
      !event.defaultPrevented
    ) {
      event.preventDefault()
      navigate(props.href)
    }
  }

  return (
    <Headless.DataInteractive>
      <a {...props} onClick={handleClick} ref={ref} />
    </Headless.DataInteractive>
  )
})
