import { useState } from 'react';
import { FinishedOverlay } from './FinishedOverlay.tsx';
import { LobbyStage } from './LobbyStage.tsx';
import { SessionStage } from './SessionStage.tsx';

type Stage = 'waiting' | 'warmup' | 'coding' | 'wrapup' | 'finished';

const stageOrder: Stage[] = ['waiting', 'warmup', 'coding', 'wrapup', 'finished'];

export function InterviewRoom() {
  const [stage, setStage] = useState<Stage>('waiting');

  const advanceStage = () => {
    const idx = stageOrder.indexOf(stage);
    if (idx < stageOrder.length - 1) {
      setStage(stageOrder[idx + 1]);
    }
  };

  if (stage === 'waiting') {
    return <LobbyStage onAdvance={advanceStage} />;
  }

  if (stage === 'finished') {
    return <FinishedOverlay />;
  }

  return <SessionStage stage={stage} onAdvance={advanceStage} onEnd={() => setStage('finished')} />;
}
