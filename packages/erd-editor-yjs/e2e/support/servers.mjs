import { fork } from 'node:child_process';
import { createServer } from 'node:http';

import { createRelay } from './ws-server.mjs';

/**
 * The relay and the room's compactor for the e2e suite. The health check
 * answers once the compactor has synced, so no spec starts ahead of it, and a
 * reset gives a spec the room empty again with a fresh compactor in it.
 */
const port = Number(process.argv[2] ?? 5180);
const room = process.argv[3] ?? 'e2e';
const url = `ws://localhost:${port}`;

const startCompactor = () =>
  new Promise((resolve, reject) => {
    const child = fork(new URL('./compactor.mjs', import.meta.url), [url, room], {
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    const onExit = code =>
      reject(new Error(`the compactor exited with ${code} before it synced`));
    child.once('exit', onExit);
    child.once('message', () => {
      child.off('exit', onExit);
      resolve(child);
    });
  });

const stopCompactor = child =>
  new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolve();
      return;
    }
    child.once('exit', () => resolve());
    child.kill('SIGTERM');
  });

let compactor = null;
let ready = false;

const reset = async () => {
  ready = false;
  if (compactor) await stopCompactor(compactor);
  relay.dropRoom(room);
  compactor = await startCompactor();
  ready = true;
};

const server = createServer((request, response) => {
  if (request.url === '/health') {
    response.writeHead(ready ? 200 : 503).end();
    return;
  }
  if (request.url === '/reset' && request.method === 'POST') {
    reset().then(
      () => response.writeHead(200).end(),
      error => response.writeHead(500).end(String(error))
    );
    return;
  }
  response.writeHead(404).end();
});
const relay = createRelay(server);

const shutdown = async () => {
  if (compactor) await stopCompactor(compactor);
  relay.close();
  server.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(port, () => {
  reset().catch(error => {
    console.error(error);
    process.exit(1);
  });
});
