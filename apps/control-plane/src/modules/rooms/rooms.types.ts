import type { DestroyDocumentResponse, RoomConfig, TestCaseInput } from '@syncode/contracts';
import type { RoomMode, RoomStatus, SupportedLanguage } from '@syncode/shared';

export interface CreateRoomResult {
  roomId: string;
  roomCode: string;
  name: string | null;
  status: RoomStatus;
  mode: RoomMode;
  hostId: string;
  problemId: string | null;
  language: SupportedLanguage | null;
  config: RoomConfig;
  createdAt: Date;
  collabCreated: boolean;
  mediaCreated: boolean;
}

export interface DestroyRoomResult {
  collab: DestroyDocumentResponse | null;
  mediaDeleted: boolean;
}

export type TestCase = TestCaseInput;
