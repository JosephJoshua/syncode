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

  useEffect(() => {
    if (!collabUrl || !collabToken) {
      if (providerRef.current) {
        providerRef.current.destroy();
        providerRef.current = null;
      }
      setStatus('disconnected');
      setCollab(null);
      return;
    }

    // Only recreate the provider when connection params change
    const connKey = `${collabUrl}|${collabToken}|${roomId}`;
    if (connKey === connKeyRef.current && providerRef.current) {
      // Connection params unchanged — just update awareness user info
      providerRef.current.awareness.setLocalStateField('user', {
        name: userName,
        color: userColor,
        colorLight: `${userColor}33`,
      });
      return;
    }

    // Connection params changed — tear down old provider and create new one
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
      // Don't destroy immediately — StrictMode will re-run the effect.
      // The connKey check above ensures we only destroy when params actually change,
      // or when the component truly unmounts (next effect won't run).
      // Use a microtask to let StrictMode's second mount run first.
      const currentProvider = providerRef.current;
      setTimeout(() => {
        // If the provider hasn't been replaced by a new effect run, it means
        // the component truly unmounted — destroy it.
        if (providerRef.current === currentProvider) {
          currentProvider?.destroy();
          providerRef.current = null;
          connKeyRef.current = '';
        }
      }, 0);
    };
  }, [collabUrl, collabToken, roomId, userName, userColor]);

  return { status, doc: collab?.doc ?? null, awareness: collab?.awareness ?? null };
}
