import { Text } from './vendor/text';

/**
 * Portal-wide "how this works" explainer card (design principle 13: every
 * portal page gets one — brief on simple pages, substantial on complex ones).
 * Neutral zinc styling — deliberately NOT the judge-world cream of
 * ProvisioningPage's boundary card; this must read as portal chrome.
 * Children are the explanation body (typically one or more <Text> blocks).
 */
export function Explainer({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-950/10 bg-zinc-50 p-6 dark:border-white/10 dark:bg-zinc-800/50">
      <Text className="font-semibold text-zinc-900 dark:text-white">{title}</Text>
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}
