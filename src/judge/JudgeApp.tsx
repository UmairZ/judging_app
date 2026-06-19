import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useCollection, useDocData } from '../data/db';
import type { JudgeDoc } from '../data/types';
import { DEFAULT_STRUCTURE_CONFIG, type StructureConfig } from '../domain/structure';
import WelcomeScreen from './WelcomeScreen';
import QueueScreen from './QueueScreen';
import GradingScreen from './GradingScreen';
import { useJudgeQueue, type JudgeQueueItem } from './useJudgeQueue';

export default function JudgeApp() {
  const { user } = useAuth();
  const judgeId = user?.uid ?? '';
  const [screen, setScreen] = useState<'welcome' | 'queue' | 'grading'>('welcome');
  const [selected, setSelected] = useState<JudgeQueueItem | null>(null);

  const items = useJudgeQueue(judgeId);
  const judges = useCollection<JudgeDoc>('judges');
  const structure = useDocData<StructureConfig>('config/structure').data ?? DEFAULT_STRUCTURE_CONFIG;

  const judgeName = judges.find((j) => j.id === judgeId)?.name ?? 'Judge';
  const slots = [...new Set(items.map((i) => i.slotLabel))];
  const subtitle = slots.length ? slots.join(' · ') : 'Your assigned contestants';

  if (screen === 'welcome') {
    return <WelcomeScreen name={judgeName} subtitle={subtitle} onStart={() => setScreen('queue')} />;
  }
  if (screen === 'grading' && selected) {
    const minQuestions = structure.categories.find((c) => c.id === selected.category)?.minQuestions ?? 4;
    return (
      <GradingScreen
        contestant={{ name: selected.name, slotLabel: selected.slotLabel }}
        enrollmentId={selected.enrollmentId}
        judgeId={judgeId}
        minQuestions={minQuestions}
        onEnd={() => setScreen('queue')}
      />
    );
  }
  return (
    <QueueScreen
      items={items}
      onSelect={(c) => {
        setSelected(c);
        setScreen('grading');
      }}
    />
  );
}
