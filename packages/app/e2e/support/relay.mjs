import { createServer } from 'node:http';

import { WebSocketServer } from 'ws';

/**
 * A minimal in-memory nostr relay, just enough of NIP-01 for trystero to
 * complete a WebRTC handshake, so a collaboration test is deterministic and
 * offline; its HTTP side also answers the /embed specs' framer and document.
 */

const port = Number(process.argv[2] ?? 5176);
const TOPIC_TAG = 'x';
const debug = process.env.E2E_RELAY_DEBUG
  ? (...args) => console.error('[relay]', ...args)
  : () => {};

/** @type {Map<import('ws').WebSocket, Map<string, {kinds: Set<number>, topics: Set<string>}>>} */
const subscriptions = new Map();

/**
 * The /embed specs' document with no CORS header, which no routed answer can
 * be, since Playwright adds one. One table, so a fetch that got through shows.
 */
const NO_CORS_DOCUMENT = JSON.stringify({
  version: '3.0.0',
  doc: { tableIds: ['leaked'] },
  collections: { tableEntities: { leaked: { id: 'leaked', name: 'leaked' } } },
});

/** Escapes a value for a double-quoted attribute, and nothing more: it stays the URL it was. */
const escapeAttribute = value =>
  value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  // Another site framing the URL its src names, as an embed does; a routed
  // origin cannot frame localhost in Chrome, so the relay's own origin does.
  if (url.pathname === '/__framer') {
    const src = escapeAttribute(url.searchParams.get('src') ?? '');
    response.writeHead(200, { 'content-type': 'text/html' });
    response.end(
      `<!doctype html><title>Framer</title><body style="margin: 0">` +
        `<iframe src="${src}" width="100%" height="480" style="border: 0" title="ERD Editor"></iframe>`
    );
    return;
  }

  if (url.pathname === '/__docs/no-cors.erd.json') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(NO_CORS_DOCUMENT);
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
