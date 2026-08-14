import { createServer } from 'node:http';

import { WebSocketServer } from 'ws';

/**
 * A minimal in-memory nostr relay — just enough of NIP-01 for trystero to
 * complete a WebRTC handshake.
 *
 * The e2e suite points the app at this instead of the public relay pool
 * (`ERD_EDITOR_NOSTR_RELAY_URLS`), which is what makes a collaboration test
 * deterministic and offline: no third-party relay, no rate limits, no flake.
 *
 * Trystero's nostr strategy speaks exactly three client messages — `REQ` to
 * subscribe to a set of topics, `CLOSE` to drop a subscription, and `EVENT` to
 * publish — and reads back `["EVENT", subId, event]`. Signature verification,
 * persistence, and every other relay responsibility are deliberately absent;
 * trystero encrypts its own payloads and ignores events from itself.
 */

const port = Number(process.argv[2] ?? 5176);
const TOPIC_TAG = 'x';
const debug = process.env.E2E_RELAY_DEBUG
  ? (...args) => console.error('[relay]', ...args)
  : () => {};

/** @type {Map<import('ws').WebSocket, Map<string, {kinds: Set<number>, topics: Set<string>}>>} */
const subscriptions = new Map();

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({ server });

const send = (socket, message) => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  }
};

const topicOf = event =>
  event?.tags?.find(tag => tag[0] === TOPIC_TAG)?.[1] ?? null;

const broadcast = event => {
  const topic = topicOf(event);

  subscriptions.forEach((subs, socket) => {
    subs.forEach((filter, subId) => {
      const matchesKind = !filter.kinds.size || filter.kinds.has(event.kind);
      const matchesTopic =
        !filter.topics.size || (topic !== null && filter.topics.has(topic));

      if (matchesKind && matchesTopic) {
        debug('deliver', topic, '->', subId);
        send(socket, ['EVENT', subId, event]);
      }
    });
  });
};

wss.on('connection', socket => {
  subscriptions.set(socket, new Map());

  socket.on('message', raw => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (!Array.isArray(message)) return;

    const [type, ...rest] = message;
    const subs = subscriptions.get(socket);
    if (!subs) return;

    if (type === 'REQ') {
      const [subId, filter = {}] = rest;
      debug('REQ', subId, JSON.stringify(filter));
      subs.set(subId, {
        kinds: new Set(filter.kinds ?? []),
        topics: new Set(filter[`#${TOPIC_TAG}`] ?? []),
      });
      // There is no stored history, so end-of-stored-events is immediate.
      send(socket, ['EOSE', subId]);
      return;
    }

    if (type === 'CLOSE') {
      subs.delete(rest[0]);
      return;
    }

    if (type === 'EVENT') {
      const [event] = rest;
      if (!event?.id) return;

      debug('EVENT', event.kind, topicOf(event));
      send(socket, ['OK', event.id, true, '']);
      broadcast(event);
    }
  });

  socket.on('close', () => {
    subscriptions.delete(socket);
  });
});

server.listen(port, () => {
  console.log(`e2e nostr relay listening on ws://localhost:${port}`);
});

const shutdown = () => {
  wss.close();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
