import { useState } from 'react';
import WelcomeScreen from './WelcomeScreen';
import QueueScreen from './QueueScreen';
import GradingScreen from './GradingScreen';
import type { QueueContestant } from './sampleQueue';

type Screen = 'welcome' | 'queue' | 'grading';

export default function JudgeApp() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [selected, setSelected] = useState<QueueContestant | null>(null);

  if (screen === 'welcome') return <WelcomeScreen onStart={() => setScreen('queue')} />;
  if (screen === 'grading' && selected) {
    return (
      <GradingScreen
        contestant={{ name: selected.name, slotLabel: selected.slotLabel }}
        onEnd={() => setScreen('queue')}
      />
    );
  }
  return (
    <QueueScreen
      onSelect={(c) => {
        setSelected(c);
        setScreen('grading');
      }}
    />
  );
}
