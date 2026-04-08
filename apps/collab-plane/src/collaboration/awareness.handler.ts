import { Injectable, Logger } from '@nestjs/common';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import * as awarenessProtocol from 'y-protocols/awareness';
import type { AuthenticatedClient } from '../auth/index.js';
import { RoomRegistry } from './room-registry.js';
import { WsMessageType } from './ws-message-types.js';
import { YjsDocumentStore } from './yjs-document-store.js';

interface RoomAwareness {
  awareness: awarenessProtocol.Awareness;
  userClientIds: Map<string, Set<number>>;
  lastUpdate: Map<string, number>;
}

@Injectable()
export class AwarenessHandler {
  private readonly logger = new Logger(AwarenessHandler.name);
  private readonly rooms = new Map<string, RoomAwareness>();

  constructor(
    private readonly docStore: YjsDocumentStore,
    private readonly roomRegistry: RoomRegistry,
  ) {}

  createRoom(roomId: string): void {
    const doc = this.docStore.getDoc(roomId);
    if (!doc) {
      return;
    }

    const awareness = new awarenessProtocol.Awareness(doc);
    awareness.setLocalState(null);

    const roomAwareness: RoomAwareness = {
      awareness,
      userClientIds: new Map(),
      lastUpdate: new Map(),
    };

    awareness.on(
      'update',
      (
        { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
        origin: string | null,
      ) => {
        // Track clientIDs from the added array when origin is a userId string
        if (typeof origin === 'string') {
          for (const clientId of added) {
            let ids = roomAwareness.userClientIds.get(origin);
            if (!ids) {
              ids = new Set();
              roomAwareness.userClientIds.set(origin, ids);
            }
            ids.add(clientId);
          }
        }

        const changedClients = added.concat(updated, removed);
        const message = this.encodeAwarenessUpdate(awareness, changedClients);

        const room = this.roomRegistry.getRoom(roomId);
        if (!room) {
          return;
        }

        for (const [userId, client] of room.clients) {
          if (userId !== origin) {
            client.send(message);
          }
        }
      },
    );

    this.rooms.set(roomId, roomAwareness);
    this.logger.log(`Awareness created for room ${roomId}`);
  }

  handleAwarenessMessage(roomId: string, senderUserId: string, message: Uint8Array): void {
    const roomAwareness = this.rooms.get(roomId);
    if (!roomAwareness) {
      return;
    }

    const now = Date.now();
    const lastUpdate = roomAwareness.lastUpdate.get(senderUserId) ?? 0;
    if (now - lastUpdate < 50) {
      return;
    }
    roomAwareness.lastUpdate.set(senderUserId, now);

    const decoder = decoding.createDecoder(message);
    decoding.readVarUint(decoder); // skip messageAwareness byte (0x01)
    const payload = decoding.readVarUint8Array(decoder);

    awarenessProtocol.applyAwarenessUpdate(roomAwareness.awareness, payload, senderUserId);
  }

  sendFullAwareness(roomId: string, client: AuthenticatedClient): void {
    const roomAwareness = this.rooms.get(roomId);
    if (!roomAwareness) {
      return;
    }

    const states = roomAwareness.awareness.getStates();
    if (states.size === 0) {
      return;
    }

    client.send(this.encodeAwarenessUpdate(roomAwareness.awareness, Array.from(states.keys())));
  }

  private encodeAwarenessUpdate(
    awareness: awarenessProtocol.Awareness,
    clientIds: number[],
  ): Uint8Array {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, WsMessageType.AWARENESS);
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
    );
    return encoding.toUint8Array(encoder);
  }

  removeClient(roomId: string, userId: string): void {
    const roomAwareness = this.rooms.get(roomId);
    if (!roomAwareness) {
      return;
    }

    const clientIds = roomAwareness.userClientIds.get(userId);
    if (clientIds && clientIds.size > 0) {
      awarenessProtocol.removeAwarenessStates(roomAwareness.awareness, [...clientIds], null);
    }

    roomAwareness.userClientIds.delete(userId);
    roomAwareness.lastUpdate.delete(userId);
  }

  destroyRoom(roomId: string): void {
    const roomAwareness = this.rooms.get(roomId);
    if (!roomAwareness) {
      return;
    }

    roomAwareness.awareness.destroy();
    this.rooms.delete(roomId);
    this.logger.log(`Awareness destroyed for room ${roomId}`);
  }
}
