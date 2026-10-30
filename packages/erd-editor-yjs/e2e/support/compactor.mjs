import { createPeerStore } from '@dineug/erd-editor/peer.js';
import { bindPeerStore } from '@dineug/erd-editor-yjs';
import WebSocket from 'ws';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

/**
 * The room's one compactor, a relay client in a process of its own as a sidecar
 * runs: a peer store on its own replica, folding past three entries once synced.
 */
const [url, room] = process.argv.slice(2);

const doc = new Y.Doc();
const provider = new WebsocketProvider(url, room, doc, {
  WebSocketPolyfill: WebSocket,
  disableBc: true,
});
const synced = new Promise(resolve => {
  const onSync = isSynced => {
    if (!isSynced) return;
    provider.off('sync', onSync);
    resolve();
  };
  provider.on('sync', onSync);
});

const peer = createPeerStore({ nickname: 'server', presence: false });
const binding = bindPeerStore(peer, doc, { compactAfter: 3, synced });
binding.on('error', error => console.error(error));

const stop = () => {
  binding.destroy();
  peer.destroy();
  provider.destroy();
  doc.destroy();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('disconnect', stop);

await synced;
process.send?.({ ready: true });
