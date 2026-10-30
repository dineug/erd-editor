import * as decoding from 'lib0/decoding';
import * as encoding from 'lib0/encoding';
import { WebSocket, WebSocketServer } from 'ws';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as syncProtocol from 'y-protocols/sync';
import * as Y from 'yjs';

/** The two message kinds a WebsocketProvider sends and reads, as it numbers them. */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const send = (socket, message) => {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(message, error => {
    if (error) socket.close();
  });
};

const syncMessage = write => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  write(encoder);
  return encoding.toUint8Array(encoder);
};

const awarenessMessage = update => {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
};

/**
 * One room: the relay's replica of the document, which answers a joiner's
 * state vector, the presence of everyone in it, and each socket with the
 * presence clients it brought, which leave with it.
 */
function createRoom() {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);
  const sockets = new Map();

  const broadcast = message => {
    for (const socket of sockets.keys()) send(socket, message);
  };

  doc.on('update', update => {
    broadcast(syncMessage(encoder => syncProtocol.writeUpdate(encoder, update)));
  });

  // A client that comes back after it sent its state as gone renews it as an
  // update rather than an add, so a socket owns every state it last wrote.
  awareness.on('update', ({ added, updated, removed }, origin) => {
    const controlled = sockets.get(origin);
    if (controlled) {
      for (const clientId of added.concat(updated)) {
        sockets.forEach(owned => owned.delete(clientId));
        controlled.add(clientId);
      }
      removed.forEach(clientId => controlled.delete(clientId));
    }
    const changed = added.concat(updated, removed);
    broadcast(
      awarenessMessage(awarenessProtocol.encodeAwarenessUpdate(awareness, changed))
    );
  });

  const receive = (socket, data) => {
    const decoder = decoding.createDecoder(data);
    switch (decoding.readVarUint(decoder)) {
      case MESSAGE_SYNC: {
        const reply = encoding.createEncoder();
        encoding.writeVarUint(reply, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, reply, doc, socket);
        if (encoding.length(reply) > 1) send(socket, encoding.toUint8Array(reply));
        break;
      }
      case MESSAGE_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(
          awareness,
          decoding.readVarUint8Array(decoder),
          socket
        );
        break;
    }
  };

  const leave = socket => {
    const controlled = sockets.get(socket);
    if (!controlled) return;
    sockets.delete(socket);
    awarenessProtocol.removeAwarenessStates(awareness, Array.from(controlled), null);
  };

  return {
    join: socket => {
      sockets.set(socket, new Set());
      socket.on('message', data => receive(socket, new Uint8Array(data)));
      socket.on('close', () => leave(socket));

      send(socket, syncMessage(encoder => syncProtocol.writeSyncStep1(encoder, doc)));
      const present = Array.from(awareness.getStates().keys());
      if (present.length) {
        send(
          socket,
          awarenessMessage(awarenessProtocol.encodeAwarenessUpdate(awareness, present))
        );
      }
    },
    destroy: () => {
      for (const socket of sockets.keys()) socket.terminate();
      sockets.clear();
      awareness.destroy();
      doc.destroy();
    },
  };
}

/**
 * Relays rooms over the server's upgrades, speaking the wire protocol a
 * WebsocketProvider speaks: sync step 1 and 2, updates and presence. The
 * room is the path a client connects to, and it lives as long as the relay.
 */
export function createRelay(server) {
  const rooms = new Map();
  const sockets = new WebSocketServer({ server });

  sockets.on('connection', (socket, request) => {
    const name = (request.url ?? '/').slice(1).split('?')[0];
    let room = rooms.get(name);
    if (!room) {
      room = createRoom();
      rooms.set(name, room);
    }
    room.join(socket);
  });

  return {
    /** Forgets a room and closes its sockets, so the next client opens it empty. */
    dropRoom: name => {
      rooms.get(name)?.destroy();
      rooms.delete(name);
    },
    close: () => {
      for (const room of rooms.values()) room.destroy();
      rooms.clear();
      sockets.close();
    },
  };
}
