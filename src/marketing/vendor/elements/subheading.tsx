// Adapted from "Oatmeal" (Tailwind Plus), used under the Tailwind Plus license
// as part of the Ubayy application. Not for redistribution outside this product.
import { clsx } from 'clsx/lite'
import { type ComponentProps } from 'react'

export function Subheading({ children, className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={clsx(
        'font-display text-[2rem]/10 tracking-tight text-pretty text-taupe-950 sm:text-5xl/14 dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </h2>
  )
}
