/* Tailwind Plus 'Catalyst' component, adapted under the Tailwind Plus license for this application.
 * Not for redistribution as a component library. https://tailwindcss.com/plus/license */
import clsx from 'clsx'

export function Divider({
  soft = false,
  className,
  ...props
}: { soft?: boolean } & React.ComponentPropsWithoutRef<'hr'>) {
  return (
    <hr
      role="presentation"
      {...props}
      className={clsx(
        className,
        'w-full border-t',
        soft && 'border-zinc-950/5 dark:border-white/5',
        !soft && 'border-zinc-950/10 dark:border-white/10'
      )}
    />
  )
}
