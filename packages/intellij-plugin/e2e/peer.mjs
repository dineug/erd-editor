// A hub peer built from node:net and a hand-written JSON lines codec, so the
// wire format the IDE's hub speaks is checked as bytes, not through the library
// that produced it. The port of FakePeer in vscode-extension's agent-hub.test.ts.
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

export const PROTOCOL_VERSION = 2;

export class Peer {
  /** Every notification received so far, and when each arrived. */
  notifications = [];
  arrivals = [];
  #buffer = '';
  #nextId = 1;
  #pending = new Map();
  #socket;

  constructor(socket) {
    this.#socket = socket;
    this.ended = new Promise(resolve => {
      socket.once('end', () => resolve('end'));
      socket.once('close', () => resolve('close'));
    });
    socket.setEncoding('utf8');
    socket.on('data', chunk => this.#receive(chunk));
    socket.on('error', () => undefined);
  }

  static connect(pipe) {
    return new Promise((resolve, reject) => {
      const socket = net.connect(pipe);
      socket.once('connect', () => resolve(new Peer(socket)));
      socket.once('error', reject);
    });
  }

  /** Connects to the hub a lock advertises and says hello with its token. */
  static async join(lock, client) {
    const peer = await Peer.connect(lock.pipe);
    await peer.call('hello', {
      token: lock.token,
      protocolVersion: PROTOCOL_VERSION,
      client,
    });
    return peer;
  }

  request(method, params, timeout = 30_000) {
    const id = this.#nextId++;
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        this.#pending.delete(id);
        resolve({ id, method, ok: false, error: { code: 'timeout' } });
      }, timeout);
      this.#pending.set(id, frame => {
        clearTimeout(timer);
        resolve(frame);
      });
      this.#socket.write(`${JSON.stringify({ id, method, params })}\n`);
    });
  }

  /** Sends a request and hands back its result, throwing on an error answer. */
  async call(method, params) {
    const response = await this.request(method, params);
    if (response.method !== method || !response.ok) {
      throw new Error(`${method} failed: ${JSON.stringify(response)}`);
    }
    return response.result;
  }

  /** The actions notifications received so far, as their action arrays. */
  actionBatches(path) {
    return this.notifications
      .filter(
        frame =>
          frame.method === 'actions' && (!path || frame.params.path === path)
      )
      .map(frame => frame.params.actions);
  }

  closedPaths() {
    return this.notifications
      .filter(frame => frame.method === 'documentClosed')
      .map(frame => frame.params.path);
  }

  /** Polls until check holds or timeout passes, and answers whether it held. */
  async waitFor(check, timeout) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (check(this)) return true;
      await sleep(25);
    }
    return check(this);
  }

  close() {
    this.#socket.destroy();
  }

  #receive(chunk) {
    this.#buffer += chunk;
    let newline = this.#buffer.indexOf('\n');
    while (newline !== -1) {
      const line = this.#buffer.slice(0, newline);
      this.#buffer = this.#buffer.slice(newline + 1);
      if (line.trim() !== '') this.#dispatch(JSON.parse(line));
      newline = this.#buffer.indexOf('\n');
    }
  }

  #dispatch(frame) {
    if (typeof frame.id !== 'number') {
      this.notifications.push(frame);
      this.arrivals.push(performance.now());
      return;
    }
    const resolve = this.#pending.get(frame.id);
    this.#pending.delete(frame.id);
    resolve?.(frame);
  }
}

/**
 * A table with a primary key column, tagged shared (1), so a webview applies
 * it without relaying it back.
 */
export function tableBatch(tableId, version) {
  const meta = { editorId: 'agent-hub-e2e', nickname: 'e2e' };
  const columnId = `${tableId}c`;
  const action = (type, payload) => ({ type, payload, version, tags: 1, meta });

  return [
    action('table.add', { id: tableId, ui: { x: 120, y: 120, zIndex: 2 } }),
    action('column.add', { id: columnId, tableId }),
    action('column.changeName', { id: columnId, tableId, value: 'id' }),
    action('column.changePrimaryKey', { id: columnId, tableId, value: true }),
  ];
}

/**
 * Whether a batch names the table. A missing id names none: it would match
 * every action whose payload carries no id.
 */
export function mentions(batches, tableId) {
  if (!tableId) return false;
  return batches.some(batch =>
    batch.some(action => action.payload?.id === tableId)
  );
}
