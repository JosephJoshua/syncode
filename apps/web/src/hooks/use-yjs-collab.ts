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
  onPhaseChange?: () => void;
}

interface CollabState {
  doc: Y.Doc;
  awareness: Awareness;
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
  onPhaseChange,
}: UseYjsCollabOptions): YjsCollabResult {
  const [status, setStatus] = useState<CollabConnectionStatus>(
    collabUrl && collabToken ? 'connecting' : 'disconnected',
  );
  const [collab, setCollab] = useState<CollabState | null>(null);
  const { t } = useTranslation('rooms');

  const patchRef = useRef(onRoomStatePatch);
  patchRef.current = onRoomStatePatch;
  const participantReadyRef = useRef(onParticipantReady);
  participantReadyRef.current = onParticipantReady;
  const phaseChangeRef = useRef(onPhaseChange);
  phaseChangeRef.current = onPhaseChange;
  const tRef = useRef(t);
  tRef.current = t;

  // Persist provider across React StrictMode double-invocations.
  // Only recreate when connection-critical params change.
  const providerRef = useRef<YjsCollabProvider | null>(null);
  const connKeyRef = useRef('');
  const latestPhaseRef = useRef('');

  // Connection lifecycle — only recreate provider when connection params change.
  // userName/userColor are NOT deps here; they update via the separate effect below.
  // biome-ignore lint/correctness/useExhaustiveDependencies: userName and userColor are intentionally excluded — they are handled by the awareness-update effect to avoid destroying the provider on metadata changes.
  useEffect(() => {
    if (!collabUrl || !collabToken) {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
        connKeyRef.current = '';
      }
      setStatus('disconnected');
      setCollab(null);
      return;
    }

    const connKey = `${collabUrl}|${collabToken}|${roomId}`;
    if (connKey === connKeyRef.current && providerRef.current) {
      return;
    }

    if (providerRef.current) {
      providerRef.current.destroy();
    }
    connKeyRef.current = connKey;

    const provider = new YjsCollabProvider({
      url: collabUrl,
      token: collabToken,
      roomId,
      user: { name: userName, color: userColor, colorLight: `${userColor}33` },
      onConnectionStatusChange: setStatus,
      onRoomStatePatch: (patch) => {
        if (patch.status) latestPhaseRef.current = patch.status;
        patchRef.current({
          status: patch.status as RoomStatus | undefined,
          editorLocked: patch.editorLocked,
        });
      },
      onParticipantReady: (userId, isReady) => {
        participantReadyRef.current(userId, isReady);
      },
      onPhaseChange: (phase) => {
        latestPhaseRef.current = phase;
        const label = ROOM_STATUS_LABELS[phase as RoomStatus] ?? phase;
        toast.info(tRef.current('workspace.phaseChanged', { phase: label }));
        phaseChangeRef.current?.();
      },
      onEditorLock: (locked) => {
        if (latestPhaseRef.current === 'finished') return;
        if (locked) {
          toast.warning(tRef.current('lobby.editorLocked'));
        } else {
          toast.info(tRef.current('lobby.editorUnlocked'));
        }
      },
    });

    providerRef.current = provider;
    setCollab({ doc: provider.doc, awareness: provider.awareness });
    provider.connect();

    return () => {
      // Defer destruction so React StrictMode's second mount can reuse the provider.
      const currentProvider = providerRef.current;
      setTimeout(() => {
        if (providerRef.current === currentProvider) {
          currentProvider?.destroy();
          providerRef.current = null;
          connKeyRef.current = '';
        }
      }, 0);
    };
  }, [collabUrl, collabToken, roomId]);

  // Update awareness user info when name/color changes (no reconnection needed).
  useEffect(() => {
    providerRef.current?.awareness.setLocalStateField('user', {
      name: userName,
      color: userColor,
      colorLight: `${userColor}33`,
    });
  }, [userName, userColor]);

  return { status, doc: collab?.doc ?? null, awareness: collab?.awareness ?? null };
}
