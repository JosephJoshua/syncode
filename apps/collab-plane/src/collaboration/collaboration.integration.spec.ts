import type { INestApplication } from '@nestjs/common';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import { CONTROL_PLANE_CALLBACK } from '@syncode/contracts';
import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';
import { CollaborationModule } from './collaboration.module.js';
import { CollaborationService } from './collaboration.service.js';
import { WsMessageType } from './ws-message-types.js';

const JWT_SECRET = 'integration-test-secret-at-least-32-characters-long';

const mockCallbackClient = {
  notifyUserDisconnected: vi.fn().mockResolvedValue(undefined),
  notifySnapshotReady: vi.fn().mockResolvedValue(undefined),
};

@Global()
@Module({
  providers: [{ provide: CONTROL_PLANE_CALLBACK, useValue: mockCallbackClient }],
  exports: [CONTROL_PLANE_CALLBACK],
})
class MockInfrastructureModule {}

let app: INestApplication;
let wsUrl: string;
let jwtService: JwtService;
let service: CollaborationService;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeToken(userId: string, roomId: string): string {
  return jwtService.sign({ sub: userId, roomId, role: 'candidate', type: 'collab' });
}

interface ClientMessages {
  json: unknown[];
  binary: Uint8Array[];
}

/**
 * Connect a WebSocket client, collect messages, and send the join handshake.
 * Returns after the join response (room-state + SyncStep1) has been received.
 */
async function connectAndJoin(
  roomId: string,
  userId: string,
): Promise<{ ws: WebSocket; messages: ClientMessages }> {
  const token = makeToken(userId, roomId);
  const ws = new WebSocket(`${wsUrl}?token=${token}`);

  const messages: ClientMessages = { json: [], binary: [] };
  ws.on('message', (data: Buffer, isBinary: boolean) => {
    if (isBinary) {
      messages.binary.push(new Uint8Array(data));
    } else {
      messages.json.push(JSON.parse(data.toString()));
    }
  });

  await new Promise<void>((resolve) => ws.on('open', resolve));
  ws.send(JSON.stringify({ type: 'join', data: { roomId } }));
  await delay(150);

  return { ws, messages };
}

/**
 * Run the y-protocols sync handshake against received SyncStep1 messages.
 * Returns a Y.Doc with the server's document state.
 */
function syncClientDoc(ws: WebSocket, binaryMessages: Uint8Array[]): Y.Doc {
  const clientDoc = new Y.Doc();

  for (const msg of binaryMessages) {
    if (msg[0] !== WsMessageType.SYNC) continue;

    const decoder = decoding.createDecoder(msg);
    decoding.readVarUint(decoder); // skip message type byte

    const responseEncoder = encoding.createEncoder();
    encoding.writeVarUint(responseEncoder, WsMessageType.SYNC);
    syncProtocol.readSyncMessage(decoder, responseEncoder, clientDoc, null);

    if (encoding.length(responseEncoder) > 1) {
      ws.send(encoding.toUint8Array(responseEncoder));
    }
  }

  // Send our own SyncStep1 to get any remaining updates
  const step1Encoder = encoding.createEncoder();
  encoding.writeVarUint(step1Encoder, WsMessageType.SYNC);
  syncProtocol.writeSyncStep1(step1Encoder, clientDoc);
  ws.send(encoding.toUint8Array(step1Encoder));

  return clientDoc;
}

/** Encode a Yjs update in the wire format: [messageSync, Update, ...bytes] */
function encodeYjsUpdate(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WsMessageType.SYNC);
  syncProtocol.writeUpdate(encoder, update);
  return encoding.toUint8Array(encoder);
}

/** Encode an awareness message in wire format: [messageAwareness, ...payload] */
function encodeAwareness(awareness: awarenessProtocol.Awareness, clientIds: number[]): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, WsMessageType.AWARENESS);
  encoding.writeVarUint8Array(
    encoder,
    awarenessProtocol.encodeAwarenessUpdate(awareness, clientIds),
  );
  return encoding.toUint8Array(encoder);
}

/** Wait until a predicate over collected messages is satisfied. */
async function waitFor(predicate: () => boolean, timeout = 2000, interval = 50): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) {
      throw new Error('waitFor timed out');
    }
    await delay(interval);
  }
}

beforeEach(async () => {
  vi.clearAllMocks();

  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [() => ({ COLLAB_JWT_SECRET: JWT_SECRET })],
      }),
      MockInfrastructureModule,
      CollaborationModule,
    ],
  }).compile();

  app = module.createNestApplication();
  app.useWebSocketAdapter(
    new WsAdapter(app, {
      messageParser: (data: { toString(): string }) => {
        try {
          const message = JSON.parse(data.toString());
          return { event: message.type, data: message.data };
        } catch {
          return { event: '', data: null };
        }
      },
    }),
  );
  await app.init();
  await app.listen(0);

  const address = app.getHttpServer().address() as { port: number };
  wsUrl = `ws://127.0.0.1:${address.port}`;
  jwtService = new JwtService({ secret: JWT_SECRET });
  service = module.get(CollaborationService);
});

afterEach(async () => {
  await app.close();
});

describe('Yjs Document Sync (integration)', () => {
  it('GIVEN room with initial content WHEN client joins and completes sync THEN client has the document', async () => {
    await service.createDocument({ roomId: 'room-1', initialContent: 'hello world' });

    const { ws, messages } = await connectAndJoin('room-1', 'user-1');

    // Should have received room-state JSON
    expect(messages.json).toHaveLength(1);
    expect(messages.json[0]).toMatchObject({ type: 'room-state' });

    // Should have received SyncStep1 binary
    expect(messages.binary.length).toBeGreaterThanOrEqual(1);
    expect(messages.binary[0]![0]).toBe(WsMessageType.SYNC);

    // Complete sync handshake and verify document content
    const clientDoc = syncClientDoc(ws, messages.binary);
    await delay(150); // wait for SyncStep2 response

    // Process any additional binary messages (SyncStep2 from server)
    for (const msg of messages.binary) {
      if (msg[0] === WsMessageType.SYNC) {
        const decoder = decoding.createDecoder(msg);
        decoding.readVarUint(decoder);
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, WsMessageType.SYNC);
        syncProtocol.readSyncMessage(decoder, enc, clientDoc, null);
      }
    }

    expect(clientDoc.getText('code').toString()).toBe('hello world');

    clientDoc.destroy();
    ws.close();
  });

  it('GIVEN two clients WHEN one sends an update THEN the other receives it with correct content', async () => {
    await service.createDocument({ roomId: 'room-1' });

    const clientA = await connectAndJoin('room-1', 'user-a');
    const clientB = await connectAndJoin('room-1', 'user-b');

    // Complete sync for both clients
    const docA = syncClientDoc(clientA.ws, clientA.messages.binary);
    syncClientDoc(clientB.ws, clientB.messages.binary);
    await delay(150);

    // Record how many binary messages B has before the edit
    const binaryCountBefore = clientB.messages.binary.length;

    // Client A makes an edit
    let capturedUpdate!: Uint8Array;
    docA.on('update', (update: Uint8Array) => {
      capturedUpdate = update;
    });
    docA.getText('code').insert(0, 'collaborative edit');

    // Send the update to the server
    clientA.ws.send(encodeYjsUpdate(capturedUpdate));

    // Wait for Client B to receive the broadcast
    await waitFor(() => clientB.messages.binary.length > binaryCountBefore);

    // The new message should be a sync Update
    const broadcast = clientB.messages.binary[clientB.messages.binary.length - 1]!;
    expect(broadcast[0]).toBe(WsMessageType.SYNC);

    // Apply the broadcast to a fresh doc to verify content
    const verifyDoc = new Y.Doc();
    const decoder = decoding.createDecoder(broadcast);
    decoding.readVarUint(decoder); // message type
    const enc = encoding.createEncoder();
    syncProtocol.readSyncMessage(decoder, enc, verifyDoc, null);
    expect(verifyDoc.getText('code').toString()).toBe('collaborative edit');

    verifyDoc.destroy();
    docA.destroy();
    clientA.ws.close();
    clientB.ws.close();
  });

  it('GIVEN two clients WHEN one sends awareness THEN the other receives the broadcast', async () => {
    await service.createDocument({ roomId: 'room-1' });

    const clientA = await connectAndJoin('room-1', 'user-a');
    const clientB = await connectAndJoin('room-1', 'user-b');
    await delay(100);

    const binaryCountBefore = clientB.messages.binary.length;

    // Client A sends awareness (cursor position)
    const localDoc = new Y.Doc();
    const localAwareness = new awarenessProtocol.Awareness(localDoc);
    localAwareness.setLocalState({ cursor: { line: 5, ch: 10 } });
    clientA.ws.send(encodeAwareness(localAwareness, [localDoc.clientID]));

    // Wait for Client B to receive the awareness broadcast
    await waitFor(() => clientB.messages.binary.length > binaryCountBefore);

    const received = clientB.messages.binary[clientB.messages.binary.length - 1]!;
    expect(received[0]).toBe(WsMessageType.AWARENESS);

    localAwareness.destroy();
    localDoc.destroy();
    clientA.ws.close();
    clientB.ws.close();
  });
});
