import { nanoid } from 'nanoid';
import { io, Socket } from 'socket.io-client';

import { SchemaService } from '@/services/indexeddb/modules/schema/service';
import {
  dispatch,
  replicationSchemaEntityAction,
} from '@/utils/broadcastChannel';
import {
  decryptFromJson,
  EncryptJson,
  encryptToJson,
  exportKey,
  generateKey,
} from '@/utils/crypto';

type Session = {
  schemaId: string;
  roomId: string;
  secretKey: string;
  key: CryptoKey;
};

export class CollaborativeService {
  private sessionMap = new Map<string, Session>();
  private roomIdToSchemaIdMap = new Map<string, string>();
  #socket: Socket | null = null;
  constructor(private service: SchemaService) {}

  get socket(): Socket {
    if (!this.#socket) {
      const socket = io(import.meta.env.WEBSOCKET_URL);

      socket
        .on('request-host-schema', async roomId => {
          const schemaId = this.roomIdToSchemaIdMap.get(roomId);
          if (!schemaId) return;

          const session = this.sessionMap.get(schemaId);
          if (!session) return;

          const result = await this.service.get(schemaId);
          if (!result) return;

          const value = await encryptToJson(result.value, session.key);
          socket.emit('host-schema', { roomId, value });
        })
        .on(
          'dispatch',
          async ({ roomId, value }: { roomId: string; value: EncryptJson }) => {
            const schemaId = this.roomIdToSchemaIdMap.get(roomId);
            if (!schemaId) return;

            const session = this.sessionMap.get(schemaId);
            if (!session) return;

            const json = await decryptFromJson(value, session.key);
            const actions = JSON.parse(json);

            this.service.replication(schemaId, actions);
            dispatch(
              replicationSchemaEntityAction({
                id: schemaId,
                actions,
              })
            );
          }
        );

      this.#socket = socket;
    }
    return this.#socket;
  }

  private disconnect() {
    this.#socket?.disconnect();
    this.#socket = null;
  }

  async startSession(schemaId: string) {
    const key = await generateKey();
    const jwk = await exportKey(key);
    const secretKey = jwk.k!;
    const roomId = nanoid();

    this.sessionMap.set(schemaId, { schemaId, roomId, secretKey, key });
    this.roomIdToSchemaIdMap.set(roomId, schemaId);
    this.socket.emit('host-join-room', roomId);

    return { roomId, secretKey };
  }

  async stopSession(schemaId: string) {
    const session = this.sessionMap.get(schemaId);
    if (!session) return;

    this.sessionMap.delete(schemaId);
    this.roomIdToSchemaIdMap.delete(session.roomId);
    this.socket.emit('host-leave-room', session.roomId);

    if (this.sessionMap.size === 0) {
      this.disconnect();
    }
  }

  async dispatch(schemaId: string, actions: any) {
    if (!this.#socket) return;

    const session = this.sessionMap.get(schemaId);
    if (!session) return;

    const value = await encryptToJson(JSON.stringify(actions), session.key);
    this.#socket.emit('dispatch', { roomId: session.roomId, value });
  }

  async sessionAll() {
    return Array.from(this.sessionMap.values()).reduce(
      (
        acc: Record<string, [string, string]>,
        { schemaId, roomId, secretKey }
      ) => {
        acc[schemaId] = [roomId, secretKey];
        return acc;
      },
      {}
    );
  }
}
