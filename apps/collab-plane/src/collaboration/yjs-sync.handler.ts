import { Injectable, Logger } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as syncProtocol from 'y-protocols/sync';
import type { AuthenticatedClient } from '../auth/index.js';
import { RoomRegistry } from './room-registry.js';
import { WsMessageType } from './ws-message-types.js';
import { YjsDocumentStore } from './yjs-document-store.js';

@Injectable()
export class YjsSyncHandler {
  private static readonly SYNC_STEP2 = 1;
  private static readonly SYNC_UPDATE = 2;

  private readonly logger = new Logger(YjsSyncHandler.name);

  constructor(
    private readonly docStore: YjsDocumentStore,
    private readonly roomRegistry: RoomRegistry,
  ) {}

  /**
   * Registers a `doc.on('update')` listener that broadcasts updates
   * to all clients in the room except the origin (the user who made the edit).
   *
   * Wire format for broadcast: [messageSync (0), Update sub-type (2), ...update bytes]
   */
  registerUpdateBroadcast(roomId: string): void {
    const doc = this.docStore.getDoc(roomId);
    if (!doc) {
      return;
    }

    doc.on('update', (update: Uint8Array, origin: string | null) => {
      const room = this.roomRegistry.getRoom(roomId);
      if (!room) {
        return;
      }

      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, WsMessageType.SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);

      for (const [userId, client] of room.clients) {
        if (userId !== origin) {
          client.send(message);
        }
      }
    });

    this.logger.log(`Update broadcast registered for room ${roomId}`);
  }

  /**
   * Handles a binary y-protocols sync message from a client.
   *
   * - SyncStep1: server responds with SyncStep2 (updates the client is missing)
   * - SyncStep2/Update: server applies updates to doc (triggers doc.on('update') for broadcast)
   */
  handleSyncMessage(roomId: string, senderUserId: string, message: Uint8Array): void {
    const doc = this.docStore.getDoc(roomId);
    if (!doc) {
      return;
    }

    // Editor lock enforcement: block Yjs writes (SyncStep2 + Update) from restricted users.
    // Both sub-types apply updates via Y.applyUpdate — blocking only Update would let
    // a crafted SyncStep2 bypass the lock.
    // message[0] = WsMessageType.SYNC (outer envelope), message[1] = sync sub-type
    if (message[1] === YjsSyncHandler.SYNC_STEP2 || message[1] === YjsSyncHandler.SYNC_UPDATE) {
      const room = this.roomRegistry.getRoom(roomId);
      const client = this.roomRegistry.getClient(roomId, senderUserId);
      if (room && client?.user) {
        const { role } = client.user;
        if (role === 'observer' || (room.editorLocked && role === 'candidate')) {
          this.logger.debug(
            `Blocked Yjs update from ${role} user ${senderUserId} in room ${roomId} (editorLocked=${room.editorLocked})`,
          );
          return;
        }
      }
    }

    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder); // skip application-level message type byte

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.SYNC);

    syncProtocol.readSyncMessage(decoder, encoder, doc, senderUserId);

    // If readSyncMessage wrote a response (SyncStep2), send it back to the sender
    if (encoding.length(encoder) > 1) {
      const client = this.roomRegistry.getClient(roomId, senderUserId);
      if (client) {
        client.send(encoding.toUint8Array(encoder));
      }
    }
  }

  /**
   * Sends the initial SyncStep1 to a newly connected client, initiating
   * the y-protocols sync handshake.
   */
  sendInitialSync(roomId: string, client: AuthenticatedClient): void {
    const doc = this.docStore.getDoc(roomId);
    if (!doc) {
      return;
    }

    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // messageSync
    syncProtocol.writeSyncStep1(encoder, doc);
    client.send(encoding.toUint8Array(encoder));
  }
}
