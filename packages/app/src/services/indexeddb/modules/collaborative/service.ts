import { nanoid } from '@dineug/shared';

import { exportKey, generateKey } from '@/utils/crypto';

type Session = {
  roomId: string;
  secretKey: string;
};

/**
 * Mints and remembers the credentials for every live collaboration session. Only
 * a registry, since the connections open on the main thread, and keeping it here
 * lets a session outlive the tab that started it.
 */
export class CollaborativeService {
  #sessionMap = new Map<string, Session>();

  async startSession(schemaId: string) {
    const prev = this.#sessionMap.get(schemaId);
    if (prev) return { ...prev };

    const key = await generateKey();
    const jwk = await exportKey(key);
    const session: Session = { roomId: nanoid(), secretKey: jwk.k! };

    this.#sessionMap.set(schemaId, session);
    return { ...session };
  }

  async stopSession(schemaId: string) {
    this.#sessionMap.delete(schemaId);
  }

  async sessionAll() {
    return Array.from(this.#sessionMap.entries()).reduce(
      (
        acc: Record<string, [string, string]>,
        [schemaId, { roomId, secretKey }]
      ) => {
        acc[schemaId] = [roomId, secretKey];
        return acc;
      },
      {}
    );
  }
}
