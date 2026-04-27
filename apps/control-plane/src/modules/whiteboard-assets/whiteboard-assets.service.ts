import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { ERROR_CODES } from '@syncode/contracts';
import { type Database, roomParticipants, rooms } from '@syncode/db';
import {
  isWhiteboardImageType,
  maxBytesForContentType,
  type RoomRole,
  resolveRoomPermissions,
  type WhiteboardAllowedContentType,
} from '@syncode/shared';
import { type IStorageService, STORAGE_SERVICE } from '@syncode/shared/ports';
import { and, eq } from 'drizzle-orm';
import { DB_CLIENT } from '@/modules/db/db.module.js';

interface UploadUrlInput {
  roomId: string;
  userId: string;
  filename: string;
  contentType: WhiteboardAllowedContentType;
  contentLength: number;
}

interface UploadUrlOutput {
  uploadUrl: string;
  downloadUrl: string;
  key: string;
}

@Injectable()
export class WhiteboardAssetsService {
  private static readonly KEY_PREFIX = 'whiteboard';
  private static readonly UPLOAD_URL_EXPIRY_SECONDS = 600;
  private static readonly DOWNLOAD_URL_EXPIRY_SECONDS = 7 * 24 * 60 * 60;
  private static readonly FILENAME_SANITIZE = /[^a-z0-9.\-_]+/gi;

  constructor(
    @Inject(DB_CLIENT) private readonly db: Database,
    @Inject(STORAGE_SERVICE) private readonly storageService: IStorageService,
  ) {}

  async createUploadUrl({
    roomId,
    userId,
    filename,
    contentType,
    contentLength,
  }: UploadUrlInput): Promise<UploadUrlOutput> {
    const maxBytes = maxBytesForContentType(contentType);
    if (contentLength > maxBytes) {
      throw new PayloadTooLargeException({
        message: isWhiteboardImageType(contentType)
          ? `Image asset exceeds the maximum allowed size of ${maxBytes} bytes`
          : `Video asset exceeds the maximum allowed size of ${maxBytes} bytes`,
        code: ERROR_CODES.WHITEBOARD_ASSET_TOO_LARGE,
      });
    }

    await this.assertCanAnnotateOrDraw(roomId, userId);

    const key = WhiteboardAssetsService.buildKey(roomId, filename);

    const [uploadUrl, downloadUrl] = await Promise.all([
      this.storageService.getUploadUrl(key, {
        expiresInSeconds: WhiteboardAssetsService.UPLOAD_URL_EXPIRY_SECONDS,
        contentType,
      }),
      this.storageService.getDownloadUrl(key, WhiteboardAssetsService.DOWNLOAD_URL_EXPIRY_SECONDS),
    ]);

    return { uploadUrl, downloadUrl, key };
  }

  // Active room-membership check that maps to the same role/host derivation
  // RoomsService uses for code-related capabilities. Either whiteboard:draw or
  // whiteboard:annotate is sufficient — the layer the asset belongs to is
  // chosen client-side by the user when the shape is created.
  private async assertCanAnnotateOrDraw(roomId: string, userId: string): Promise<void> {
    const [[room], [participant]] = await Promise.all([
      this.db.select().from(rooms).where(eq(rooms.id, roomId)),
      this.db
        .select({
          role: roomParticipants.role,
          isActive: roomParticipants.isActive,
        })
        .from(roomParticipants)
        .where(and(eq(roomParticipants.roomId, roomId), eq(roomParticipants.userId, userId))),
    ]);

    if (!room) {
      throw new NotFoundException({
        message: 'Room not found',
        code: ERROR_CODES.ROOM_NOT_FOUND,
      });
    }

    if (!participant?.isActive) {
      throw new ForbiddenException({
        message: 'Not a participant of this room',
        code: ERROR_CODES.ROOM_ACCESS_DENIED,
      });
    }

    const capabilities = resolveRoomPermissions(participant.role as RoomRole, {
      isHost: room.hostId === userId,
    });

    if (!capabilities.has('whiteboard:draw') && !capabilities.has('whiteboard:annotate')) {
      throw new ForbiddenException({
        message: 'You do not have permission to upload whiteboard assets in this room',
        code: ERROR_CODES.ROOM_PERMISSION_DENIED,
      });
    }
  }

  static buildKey(roomId: string, filename: string): string {
    const safe = filename.replace(WhiteboardAssetsService.FILENAME_SANITIZE, '_').slice(0, 200);
    return `${WhiteboardAssetsService.KEY_PREFIX}/${roomId}/${randomUUID()}-${safe}`;
  }
}
