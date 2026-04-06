import { getNextStatuses, ROOM_STATUS_LABELS, RoomStatus } from '@syncode/shared';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@syncode/ui';
import { CheckCircle2, Code2, FastForward, PlayCircle } from 'lucide-react';
import { type ReactNode, useState } from 'react';

// Maps transitions to their appropriate lucide-icons
const TRANSITION_ICONS: Partial<Record<RoomStatus, ReactNode>> = {
  [RoomStatus.WARMUP]: <PlayCircle className="mr-2 h-4 w-4" />,
  [RoomStatus.CODING]: <Code2 className="mr-2 h-4 w-4" />,
  [RoomStatus.WRAPUP]: <FastForward className="mr-2 h-4 w-4" />,
  [RoomStatus.FINISHED]: <CheckCircle2 className="mr-2 h-4 w-4" />,
};

export function HostControlPanel() {
  // Local mocked state for UI testing
  const [currentStage, setCurrentStage] = useState<RoomStatus>(RoomStatus.WAITING);

  // Derive next possible stages
  const nextStages = getNextStatuses(currentStage);

  const handleTransition = (target: RoomStatus) => {
    // TODO: Replace this state update with react-query mutation (POST /rooms/{roomId}/control/transition) once Issue #114 is merged.
    setCurrentStage(target);
  };

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Host Control</span>
          <span className="text-sm font-normal text-muted-foreground bg-muted px-2 py-1 rounded-md">
            Stage:{' '}
            <span className="font-medium text-foreground">{ROOM_STATUS_LABELS[currentStage]}</span>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {currentStage === RoomStatus.FINISHED ? (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Session has concluded.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground mb-2">Advance interview stage:</p>
            {nextStages.map((stage) => (
              <Button
                key={stage}
                variant={stage === RoomStatus.FINISHED ? 'destructive' : 'default'}
                className="w-full justify-start"
                onClick={() => handleTransition(stage)}
              >
                {TRANSITION_ICONS[stage]}
                {stage === RoomStatus.FINISHED
                  ? 'End Session'
                  : `Advance to ${ROOM_STATUS_LABELS[stage]}`}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
