// Adapted from "Oatmeal" (Tailwind Plus), used under the Tailwind Plus license
// as part of the Ubayy application. Not for redistribution outside this product.
import { clsx } from 'clsx/lite'
import type { ComponentProps } from 'react'

export function Eyebrow({ children, className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={clsx('text-sm/7 font-semibold text-taupe-700 dark:text-taupe-400', className)} {...props}>
      {children}
    </div>
  )
}
