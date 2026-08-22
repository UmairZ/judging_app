// Adapted from "Oatmeal" (Tailwind Plus), used under the Tailwind Plus license
// as part of the Ubayy application. Not for redistribution outside this product.

import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function Main({ children, className, ...props }: ComponentProps<'main'>) {
  return (
    <main className={clsx('isolate overflow-clip', className)} {...props}>
      {children}
    </main>
  )
}
