import { useDocData } from '../../data/db';
import { useTenant } from '../../tenant/TenantContext';
import { compBasePath } from '../../tenant/paths';
import type { StructureConfig } from '../../domain/structure';
import { CompetitionStats } from '../comp-stats';
import { STATUS_LABEL, statusColor, type CompStatus } from '../lifecycle';
import { Badge } from '../vendor/badge';
import { Button } from '../vendor/button';
import { DescriptionDetails, DescriptionList, DescriptionTerm } from '../vendor/description-list';
import { Heading } from '../vendor/heading';

interface CompDoc {
  name: string;
  status: CompStatus;
}

/** "3" when every category shares the same minimum, "3–6" across a range,
 * "—" with no categories configured yet. */
function minQuestionsSummary(structure: StructureConfig | null): string {
  const mins = structure?.categories?.map((c) => c.minQuestions) ?? [];
  if (mins.length === 0) return '—';
  const min = Math.min(...mins);
  const max = Math.max(...mins);
  return min === max ? String(min) : `${min}–${max}`;
}

/**
 * Competition overview: name + status, a door to the judge-facing (branded,
 * competition-day) surface, the same four headline stats as the org Home
 * page, and a quick-facts list drawn from the structure config. orgId/compId
 * come from the enclosing TenantProvider — always real, never a placeholder.
 */
export function OverviewPage() {
  const { orgId, compId } = useTenant();
  const base = compBasePath(orgId, compId);
  const comp = useDocData<CompDoc>(base);
  const structure = useDocData<StructureConfig>(`${base}/config/structure`);
  const categoriesCount = structure.data?.categories?.length ?? null;

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Heading>{comp.data?.name ?? '…'}</Heading>
        {comp.data && <Badge color={statusColor(comp.data.status)}>{STATUS_LABEL[comp.data.status] ?? comp.data.status}</Badge>}
      </div>

      <div className="mt-6">
        <Button outline href={`/${orgId}/${compId}`} target="_blank">
          Open judge welcome
        </Button>
        <p className="mt-2 text-sm text-zinc-500">The branded competition-day surface judges see.</p>
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-2 xl:grid-cols-4">
        <CompetitionStats orgId={orgId} compId={compId} />
      </div>

      <div className="mt-14">
        <DescriptionList>
          <DescriptionTerm>Categories</DescriptionTerm>
          <DescriptionDetails>{categoriesCount == null ? '—' : categoriesCount}</DescriptionDetails>
          <DescriptionTerm>Minimum questions</DescriptionTerm>
          <DescriptionDetails>{minQuestionsSummary(structure.data)}</DescriptionDetails>
        </DescriptionList>
      </div>
    </>
  );
}
