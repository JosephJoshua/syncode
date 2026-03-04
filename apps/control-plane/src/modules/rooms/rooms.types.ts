import type {
  CreateDocumentResponse,
  DestroyDocumentResponse,
  TestCaseInput,
} from '@syncode/contracts';

export interface CreateRoomResult {
  collab: CreateDocumentResponse | null;
  mediaCreated: boolean;
}

export interface DestroyRoomResult {
  collab: DestroyDocumentResponse | null;
  mediaDeleted: boolean;
}

export type TestCase = TestCaseInput;
