import {
  COLLAB_WS_EVENTS,
  type CollabWsMessage,
  type EditorLockEventData,
  type ParticipantReadyEventData,
  type PhaseChangeEventData,
  type RoomStateEventData,
} from '@syncode/contracts';
import type { RoomStatus } from '@syncode/shared';
import { ROOM_STATUS_LABELS } from '@syncode/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

/** Only reconnect on standard close codes (network issues). All 4xxx codes are
 *  intentional server rejections where retrying won't help. */
function shouldReconnect(code: number): boolean {
  return code < 4000;
}

const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;

export interface UseCollabSocketOptions {
  collabUrl: string | null;
  collabToken: string | null;
  roomId: string;
  onRoomStatePatch: (patch: { status?: RoomStatus; editorLocked?: boolean }) => void;
  onParticipantReady: (userId: string, isReady: boolean) => void;
}

export type CollabConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export function useCollabSocket({
  collabUrl,
  collabToken,
  roomId,
  onRoomStatePatch,
  onParticipantReady,
}: UseCollabSocketOptions): CollabConnectionStatus {
  const [status, setStatus] = useState<CollabConnectionStatus>(
    collabUrl && collabToken ? 'connecting' : 'disconnected',
  );
  const { t } = useTranslation('rooms');
  const patchRef = useRef(onRoomStatePatch);
  patchRef.current = onRoomStatePatch;
  const participantReadyRef = useRef(onParticipantReady);
  participantReadyRef.current = onParticipantReady;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!collabUrl || !collabToken) {
      setStatus('disconnected');
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let backoffMs = INITIAL_BACKOFF_MS;
    let disposed = false;
    let hasConnected = false;

    function connect() {
      if (disposed) return;

      setStatus(hasConnected ? 'reconnecting' : 'connecting');

      const url = new URL(collabUrl!);
      if (url.protocol === 'https:') url.protocol = 'wss:';
      else if (url.protocol === 'http:') url.protocol = 'ws:';
      url.searchParams.set('token', collabToken!);

      ws = new WebSocket(url);

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: 'join', data: { roomId } }));
      };

      ws.onmessage = (event) => {
        if (typeof event.data !== 'string') return;

        // First message received means join succeeded
        backoffMs = INITIAL_BACKOFF_MS;
        hasConnected = true;
        setStatus('connected');

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
          case COLLAB_WS_EVENTS.PARTICIPANT_READY: {
            const data = message.data as ParticipantReadyEventData;
            participantReadyRef.current(data.userId, data.isReady);
            break;
          }
        }
      };

      ws.onclose = (event) => {
        ws = null;
        if (disposed) return;
        if (!shouldReconnect(event.code)) {
          setStatus('disconnected');
          return;
        }

        setStatus('reconnecting');
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, backoffMs);

        backoffMs = Math.min(backoffMs * 2, MAX_BACKOFF_MS);
      };

      ws.onerror = () => {
        // The close event fires after onerror; reconnection is handled there.
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.close();
      }
    };
  }, [collabUrl, collabToken, roomId]);

  return status;
}
