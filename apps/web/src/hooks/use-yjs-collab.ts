import type { RoomStatus } from '@syncode/shared';
import { ROOM_STATUS_LABELS } from '@syncode/shared';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { Awareness } from 'y-protocols/awareness';
import type * as Y from 'yjs';
import { type CollabConnectionStatus, YjsCollabProvider } from '@/lib/yjs-collab-provider.js';

export type { CollabConnectionStatus } from '@/lib/yjs-collab-provider.js';

export interface UseYjsCollabOptions {
  collabUrl: string | null;
  collabToken: string | null;
  roomId: string;
  userName: string;
  userColor: string;
  onRoomStatePatch: (patch: { status?: RoomStatus; editorLocked?: boolean }) => void;
  onParticipantReady: (userId: string, isReady: boolean) => void;
}

export interface YjsCollabResult {
  status: CollabConnectionStatus;
  doc: Y.Doc | null;
  awareness: Awareness | null;
}

export function useYjsCollab({
  collabUrl,
  collabToken,
  roomId,
  userName,
  userColor,
  onRoomStatePatch,
  onParticipantReady,
}: UseYjsCollabOptions): YjsCollabResult {
  const [status, setStatus] = useState<CollabConnectionStatus>(
    collabUrl && collabToken ? 'connecting' : 'disconnected',
  );
  const [doc, setDoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<Awareness | null>(null);
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
      setDoc(null);
      setAwareness(null);
      return;
    }

    const colorLight = `${userColor}33`;

    const provider = new YjsCollabProvider({
      url: collabUrl,
      token: collabToken,
      roomId,
      user: { name: userName, color: userColor, colorLight },
      onConnectionStatusChange: setStatus,
      onRoomStatePatch: (patch) => {
        patchRef.current({
          status: patch.status as RoomStatus | undefined,
          editorLocked: patch.editorLocked,
        });
      },
      onParticipantReady: (userId, isReady) => {
        participantReadyRef.current(userId, isReady);
      },
      onPhaseChange: (phase) => {
        const label = ROOM_STATUS_LABELS[phase as RoomStatus] ?? phase;
        toast.info(tRef.current('workspace.phaseChanged', { phase: label }));
      },
      onEditorLock: (locked) => {
        if (locked) {
          toast.warning(tRef.current('lobby.editorLocked'));
        } else {
          toast.info(tRef.current('lobby.editorUnlocked'));
        }
      },
    });

    setDoc(provider.doc);
    setAwareness(provider.awareness);
    provider.connect();

    return () => {
      provider.destroy();
    };
  }, [collabUrl, collabToken, roomId, userName, userColor]);

  return { status, doc, awareness };
}
