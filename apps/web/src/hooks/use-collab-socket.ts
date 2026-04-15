import {
  COLLAB_WS_EVENTS,
  type CollabWsMessage,
  type EditorLockEventData,
  type PhaseChangeEventData,
  type RoomStateEventData,
} from '@syncode/contracts';
import type { RoomStatus } from '@syncode/shared';
import { ROOM_STATUS_LABELS } from '@syncode/shared';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export interface UseCollabSocketOptions {
  collabUrl: string | null;
  collabToken: string | null;
  roomId: string;
  onRoomStatePatch: (patch: { status?: RoomStatus; editorLocked?: boolean }) => void;
}

export function useCollabSocket({
  collabUrl,
  collabToken,
  roomId,
  onRoomStatePatch,
}: UseCollabSocketOptions): void {
  const { t } = useTranslation('rooms');
  const patchRef = useRef(onRoomStatePatch);
  patchRef.current = onRoomStatePatch;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!collabUrl || !collabToken) return;

    const url = new URL(collabUrl);
    url.searchParams.set('token', collabToken);

    const ws = new WebSocket(url);

    ws.onopen = () => {
      ws.send(JSON.stringify({ event: 'join', data: { roomId } }));
    };

    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;

      let message: CollabWsMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      switch (message.type) {
        case COLLAB_WS_EVENTS.ROOM_STATE: {
          const data = message.data as RoomStateEventData;
          patchRef.current({
            status: data.phase as RoomStatus,
            editorLocked: data.editorLocked,
          });
          break;
        }
        case COLLAB_WS_EVENTS.PHASE_CHANGE: {
          const data = message.data as PhaseChangeEventData;
          const label = ROOM_STATUS_LABELS[data.phase as RoomStatus] ?? data.phase;
          toast.info(tRef.current('workspace.phaseChanged', { phase: label }));
          break;
        }
        case COLLAB_WS_EVENTS.EDITOR_LOCK: {
          const data = message.data as EditorLockEventData;
          if (data.locked) {
            toast.warning(tRef.current('lobby.editorLocked'));
          } else {
            toast.info(tRef.current('lobby.editorUnlocked'));
          }
          break;
        }
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [collabUrl, collabToken, roomId]);
}
