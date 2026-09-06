import { useCount, useDocData } from '../data/db';
import type { StructureConfig } from '../domain/structure';
import { compBasePath } from '../tenant/paths';
import { Divider } from './vendor/divider';

/* Shared between HomePage and the competition OverviewPage — a copy of
 * ./stat.tsx WITHOUT the change-badge line (spec: no delta badges here). */
export function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <Divider />
      <div className="mt-6 text-lg/6 font-medium sm:text-sm/6">{title}</div>
      <div className="mt-3 text-3xl/8 font-semibold sm:text-2xl/8">{value}</div>
    </div>
  );
}

/** The four headline stats for one competition: registrations, sessions
 * graded, judges, categories. Only mounted once orgId/compId are known —
 * every path it subscribes to is always real. */
export function CompetitionStats({ orgId, compId }: { orgId: string; compId: string }) {
  const base = compBasePath(orgId, compId);
  const registrations = useCount(`${base}/registrations`);
  const sessionsGraded = useCount(`${base}/sessions`, 'finalizedAt');
  const judgesCount = useCount(`${base}/judges`);
  const structure = useDocData<StructureConfig>(`${base}/config/structure`);
  const categoriesCount = structure.data?.categories?.length ?? null;

  return (
    <>
      <Stat title="Registrations" value={registrations == null ? '—' : String(registrations)} />
      <Stat title="Sessions graded" value={sessionsGraded == null ? '—' : String(sessionsGraded)} />
      <Stat title="Judges" value={judgesCount == null ? '—' : String(judgesCount)} />
      <Stat title="Categories" value={categoriesCount == null ? '—' : String(categoriesCount)} />
    </>
  );
}
