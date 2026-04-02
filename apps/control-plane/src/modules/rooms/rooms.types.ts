import type { DestroyDocumentResponse, RoomConfig, TestCaseInput } from '@syncode/contracts';
import type {
  RoomCapability,
  RoomMode,
  RoomRole,
  RoomStatus,
  SupportedLanguage,
} from '@syncode/shared';

interface RoomBaseResult {
  roomId: string;
  roomCode: string;
  name: string | null;
  status: RoomStatus;
  mode: RoomMode;
  hostId: string;
  language: SupportedLanguage | null;
  createdAt: Date;
}

export interface CreateRoomResult extends RoomBaseResult {
  problemId: string | null;
  config: RoomConfig;
  collabCreated: boolean;
  mediaCreated: boolean;
}

export interface RoomSummaryResult extends RoomBaseResult {
  myRole: RoomRole;
  problemTitle: string | null;
  participantCount: number;
}

export interface ParticipantResult {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: RoomRole;
  isActive: boolean;
  joinedAt: Date;
}

export interface RoomDetailResult extends RoomBaseResult {
  problemId: string | null;
  config: RoomConfig;
  participants: ParticipantResult[];
  myRole: RoomRole;
  myCapabilities: RoomCapability[];
  currentPhaseStartedAt: Date | null;
  timerPaused: boolean;
  elapsedMs: number;
  editorLocked: boolean;
}

export interface DestroyRoomResult {
  collab: DestroyDocumentResponse | null;
  mediaDeleted: boolean;
}

export type TestCase = TestCaseInput;
