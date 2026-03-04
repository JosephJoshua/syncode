import { Injectable, Logger, NotImplementedException } from '@nestjs/common';
import type {
  CreateDocumentRequest,
  CreateDocumentResponse,
  DestroyDocumentResponse,
  KickUserRequest,
  KickUserResponse,
} from '@syncode/contracts';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  async createDocument(_request: CreateDocumentRequest): Promise<CreateDocumentResponse> {
    this.logger.log('createDocument called');
    throw new NotImplementedException();
  }

  async destroyDocument(_roomId: string): Promise<DestroyDocumentResponse> {
    this.logger.log('destroyDocument called');
    throw new NotImplementedException();
  }

  async kickUser(_roomId: string, _request: KickUserRequest): Promise<KickUserResponse> {
    this.logger.log('kickUser called');
    throw new NotImplementedException();
  }
}
