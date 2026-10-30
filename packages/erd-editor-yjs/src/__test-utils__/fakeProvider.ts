import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import * as Y from 'yjs';

/** The server's tag on what it relays, which a client never sends back. */
const HUB = Symbol('hub');

export type FakeClient = {
  readonly doc: Y.Doc;
  readonly awareness: Awareness;
  readonly online: boolean;
  /** Stops relaying both ways, as a closed socket does, and drops the others' presence. */
  disconnect: () => void;
  /** Exchanges state vectors with the server, then relays again. */
  connect: () => void;
};

export type FakeRoom = {
  /** The server's own replica of the room, which a compactor may bind to. */
  readonly server: Y.Doc;
  /** A client of the room, online unless asked; clientID fixes its Yjs client id. */
  join: (options?: { clientID?: number; online?: boolean }) => FakeClient;
  /** Destroys every Y.Doc and Awareness, so no Awareness timer outlives a spec. */
  destroy: () => void;
};

type Peer = FakeClient & { online: boolean };

/**
 * A star of Y.Docs joined by applyUpdate, the shape a websocket server gives:
 * every update a client makes reaches the server, which relays it to every
 * other client online, and a client that reconnects exchanges what it missed.
 */
export function createFakeRoom(): FakeRoom {
  const server = new Y.Doc();
  const hubAwareness = new Awareness(server);
  hubAwareness.setLocalState(null);
  const clients: Peer[] = [];

  server.on('update', (update: Uint8Array, origin: unknown) => {
    for (const client of clients) {
      if (client.online && client !== origin) {
        Y.applyUpdate(client.doc, update, HUB);
      }
    }
  });

  hubAwareness.on(
    'update',
    (
      { added, updated, removed }: Record<string, number[]>,
      origin: unknown
    ) => {
      const changed = added.concat(updated, removed);
      const update = encodeAwarenessUpdate(hubAwareness, changed);
      for (const client of clients) {
        if (client.online && client !== origin) {
          applyAwarenessUpdate(client.awareness, update, HUB);
        }
      }
    }
  );

  const join: FakeRoom['join'] = ({ clientID, online = true } = {}) => {
    const doc = new Y.Doc();
    if (clientID !== undefined) doc.clientID = clientID;
    const awareness = new Awareness(doc);

    const client: Peer = {
      doc,
      awareness,
      online,
      disconnect: () => {
        if (!client.online) return;
        client.online = false;
        removeAwarenessStates(hubAwareness, [awareness.clientID], client);
        const others = Array.from(awareness.getStates().keys()).filter(
          id => id !== awareness.clientID
        );
        removeAwarenessStates(awareness, others, HUB);
      },
      connect: () => {
        if (client.online) return;
        client.online = true;
        Y.applyUpdate(
          server,
          Y.encodeStateAsUpdate(doc, Y.encodeStateVector(server)),
          client
        );
        Y.applyUpdate(
          doc,
          Y.encodeStateAsUpdate(server, Y.encodeStateVector(doc)),
          HUB
        );
        // The server forgot this client's presence at the same clock, so it
        // renews the state first, as the provider's heartbeat would.
        awareness.setLocalState(awareness.getLocalState());
        const present = Array.from(hubAwareness.getStates().keys());
        applyAwarenessUpdate(
          awareness,
          encodeAwarenessUpdate(hubAwareness, present),
          HUB
        );
      },
    };

    doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== HUB && client.online)
        Y.applyUpdate(server, update, client);
    });
    awareness.on(
      'update',
      (
        { added, updated, removed }: Record<string, number[]>,
        origin: unknown
      ) => {
        if (origin === HUB || !client.online) return;
        const changed = added.concat(updated, removed);
        applyAwarenessUpdate(
          hubAwareness,
          encodeAwarenessUpdate(awareness, changed),
          client
        );
      }
    );

    clients.push(client);
    if (online) {
      client.online = false;
      client.connect();
    }
    return client;
  };

  return {
    server,
    join,
    destroy: () => {
      for (const client of clients) {
        client.awareness.destroy();
        client.doc.destroy();
      }
      hubAwareness.destroy();
      server.destroy();
    },
  };
}
