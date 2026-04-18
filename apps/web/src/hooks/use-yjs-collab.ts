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
  onLanguageChange?: (language: string, changedBy: string | null) => void;
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
  onLanguageChange,
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
  const languageChangeRef = useRef(onLanguageChange);
  languageChangeRef.current = onLanguageChange;
  const tRef = useRef(t);
  tRef.current = t;

  const providerRef = useRef<YjsCollabProvider | null>(null);
  const latestPhaseRef = useRef('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: userName and userColor update via the separate awareness effect below
  useEffect(() => {
    if (!collabUrl || !collabToken) {
      setStatus('disconnected');
      setCollab(null);
      return;
    }

    let disposed = false;

    const provider = new YjsCollabProvider({
      url: collabUrl,
      token: collabToken,
      roomId,
      user: { name: userName, color: userColor, colorLight: `${userColor}33` },
      onConnectionStatusChange: (s) => {
        if (!disposed) setStatus(s);
      },
      onRoomStatePatch: (patch) => {
        if (disposed) return;
        if (patch.status) latestPhaseRef.current = patch.status;
        patchRef.current({
          status: patch.status as RoomStatus | undefined,
          editorLocked: patch.editorLocked,
        });
      },
      onParticipantReady: (userId, isReady) => {
        if (!disposed) participantReadyRef.current(userId, isReady);
      },
      onPhaseChange: (phase) => {
        if (disposed) return;
        latestPhaseRef.current = phase;
        const label = ROOM_STATUS_LABELS[phase as RoomStatus] ?? phase;
        toast.info(tRef.current('workspace.phaseChanged', { phase: label }));
        phaseChangeRef.current?.();
      },
      onEditorLock: (locked) => {
        if (disposed) return;
        if (latestPhaseRef.current === 'finished') return;
        if (locked) {
          toast.warning(tRef.current('lobby.editorLocked'));
        } else {
          toast.info(tRef.current('lobby.editorUnlocked'));
        }
      },
      onLanguageChange: (language, changedBy) => {
        if (disposed) return;
        languageChangeRef.current?.(language, changedBy);
      },
    });

    providerRef.current = provider;
    setCollab({ doc: provider.doc, awareness: provider.awareness });
    provider.connect();

    return () => {
      disposed = true;
      provider.destroy();
      if (providerRef.current === provider) {
        providerRef.current = null;
      }
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
