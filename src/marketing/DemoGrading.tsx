import { useMemo } from 'react';
import { DbProvider, InMemoryBackend } from '../data/backend';
import { TenantProvider } from '../tenant/TenantContext';
import GradingScreen from '../judge/GradingScreen';

/** The landing-page demo: the real GradingScreen against an in-memory store. */
export default function DemoGrading() {
  const backend = useMemo(() => new InMemoryBackend(), []);
  return (
    <div className="overflow-hidden rounded-2xl border border-olive-300 bg-olive-50 shadow-sm">
      <div className="bg-olive-800 px-4 py-2 text-center text-sm text-olive-100">
        Live demo — grade the contestant below. Nothing is saved.
      </div>
      <DbProvider backend={backend}>
        <TenantProvider orgId="demo" compId="demo">
          <GradingScreen
            contestant={{ name: 'Yusuf al-Rashid', slotLabel: "1 Juz' · Brothers" }}
            enrollmentId="demo-enrollment"
            judgeId="demo-judge"
            minQuestions={3}
            meta={{ position: 1, total: 1, panelName: 'Demo panel', judgeIndex: 0, panelSize: 1, startedCount: 1 }}
            onEnd={() => backend.write('sessions/demo-enrollment__demo-judge', { questions: [] }, false)}
          />
        </TenantProvider>
      </DbProvider>
    </div>
  );
}
