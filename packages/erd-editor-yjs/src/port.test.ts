// @vitest-environment node
import type { ErdEditorElement } from '@dineug/erd-editor';
import { type PeerStore, tableActions$ } from '@dineug/erd-editor/peer.js';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
  addTable,
  entriesOf,
  expectConverged,
  rename,
  tableNames,
} from '@/__test-utils__/edits';
import { createHarness, type Harness } from '@/__test-utils__/harness';
import { AWARENESS_FIELD } from '@/awareness';
import { bindErdEditor } from '@/binding';
import { hasPortMethods, PORT_METHODS, portOfPeer } from '@/port';

let harness: Harness;

afterEach(() => harness?.cleanup());

/**
 * An element as the binding sees it, its shared store a peer store's methods:
 * the binding calls nothing else of either. Older leaves out the port methods.
 */
const fakeElement = (peer: PeerStore, { older = false } = {}) => {
  const getSharedStore = vi.fn((_config?: unknown) => ({
    subscribe: peer.subscribe,
    dispatchSync: peer.receive,
    flushStreamBuffers: peer.flushStreamBuffers,
    destroy: destroyStore,
    ...(older
      ? {}
      : {
          getLWW: peer.getLWW,
          mergeLWW: peer.mergeLWW,
          getVersion: peer.getVersion,
          forgetPeer: peer.forgetPeer,
          reseed,
        }),
  }));
  const destroyStore = vi.fn();
  const reseed = vi.fn(peer.reseed);
  const element = {
    get runtimeValue() {
      return peer.runtimeValue;
    },
    setInitialValue: peer.setInitialValue,
    getSharedStore,
  } as unknown as ErdEditorElement;
  return { element, getSharedStore, destroyStore, reseed };
};

describe('portOfEditor', () => {
  it('takes one shared store, its trackers off without Awareness, and lets it go on destroy', () => {
    harness = createHarness();
    const host = harness.peer('host');
    const { element, getSharedStore, destroyStore } = fakeElement(host);
    const getNickname = () => 'host';
    const binding = bindErdEditor(element, harness.room.join().doc, {
      getNickname,
    });

    expect(getSharedStore).toHaveBeenCalledTimes(1);
    expect(getSharedStore).toHaveBeenCalledWith({
      getNickname,
      mouseTracker: false,
      focusTracker: false,
    });
    expect(binding.seed(harness.peer('file').value)).toBe(true);
    host.dispatch([tableActions$.addTableAction$()]);

    const other = harness.peer('other');
    harness.bind(other, harness.room.join().doc);
    expect(other.value).toBe(host.value);

    binding.destroy();
    expect(destroyStore).toHaveBeenCalledTimes(1);
  });

  it('turns the trackers on with Awareness and shows the editor id its batches carry', () => {
    harness = createHarness();
    const host = harness.peer('host');
    const { element, getSharedStore } = fakeElement(host);
    const client = harness.room.join();
    bindErdEditor(element, client.doc, { awareness: client.awareness });

    expect(getSharedStore).toHaveBeenCalledWith({
      mouseTracker: true,
      focusTracker: true,
    });
    host.dispatch([tableActions$.addTableAction$()]);
    expect(client.awareness.getLocalState()?.[AWARENESS_FIELD]).toMatchObject({
      editorId: host.editorId,
      nickname: 'host',
    });
  });

  it('reseeds the element keeping its screen on a rejoin alone, and forgets a peer whose presence left', () => {
    harness = createHarness();
    const host = harness.peer('host', { presence: true });
    const { element, reseed } = fakeElement(host);
    const client = harness.room.join();
    const binding = bindErdEditor(element, client.doc, {
      awareness: client.awareness,
    });
    binding.seed();
    const other = harness.peer('other', { presence: true });
    const otherClient = harness.room.join();
    harness.bind(other, otherClient.doc, { awareness: otherClient.awareness });
    const replica = harness.bind(harness.peer('server'), harness.room.server);
    const rejoins = vi.fn();
    binding.on('rejoin', rejoins);

    client.disconnect();
    other.dispatch([tableActions$.addTableAction$()]);
    replica.compact();
    other.dispatch([
      { type: 'editor.sharedMouseTracker', payload: { x: 1, y: 1 } },
    ]);
    client.connect();
    expect(rejoins).toHaveBeenCalledWith('snapshot');
    expect(reseed).toHaveBeenCalledTimes(1);
    expect(reseed.mock.calls[0][1]).toMatchObject({ keepScreen: true });
    expect(host.value).toBe(other.value);

    const joiner = fakeElement(harness.peer('joiner'));
    bindErdEditor(joiner.element, harness.room.join().doc);
    expect(joiner.reseed.mock.calls[0][1]).toMatchObject({ keepScreen: false });
    expect(
      host.state.editor.sharedMouseTrackerMap[other.editorId]
    ).toBeDefined();

    otherClient.disconnect();
    expect(
      host.state.editor.sharedMouseTrackerMap[other.editorId]
    ).toBeUndefined();
  });

  it('AC-P2 a second binding of the same element and Y.Doc raises error, takes no shared store and writes nothing', async () => {
    harness = createHarness();
    const host = harness.peer('host');
    const { element, getSharedStore, destroyStore } = fakeElement(host);
    const client = harness.room.join();
    const first = bindErdEditor(element, client.doc);
    first.seed();
    const second = bindErdEditor(element, client.doc);
    const errors = vi.fn();
    second.on('error', errors);

    await Promise.resolve();
    expect(errors).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/already bound/),
      })
    );
    expect(getSharedStore).toHaveBeenCalledTimes(1);
    addTable(host, 'once');
    expect(entriesOf(client.doc)).toHaveLength(2);
    second.destroy();
    expect(destroyStore).not.toHaveBeenCalled();

    first.destroy();
    const third = bindErdEditor(element, client.doc);
    const thirdErrors = vi.fn();
    third.on('error', thirdErrors);
    await Promise.resolve();
    expect(thirdErrors).not.toHaveBeenCalled();
    expect(getSharedStore).toHaveBeenCalledTimes(2);
    third.destroy();
  });

  it('AC-P13 the same element bound, destroyed and bound again joins on a new shared store under a new id, and a client offline through a compaction loses nothing', () => {
    harness = createHarness();
    const host = harness.peer('host');
    const c = harness.peer('c');
    const server = harness.peer('server');
    const { element, getSharedStore, destroyStore, reseed } = fakeElement(host);
    const clientHost = harness.room.join();
    const clientC = harness.room.join();
    const first = bindErdEditor(element, clientHost.doc);
    first.seed();
    harness.bind(c, clientC.doc);
    const replica = harness.bind(server, harness.room.server);
    const kept = addTable(host, 'before rebinding');

    first.destroy();
    expect(destroyStore).toHaveBeenCalledTimes(1);
    const second = bindErdEditor(element, clientHost.doc);
    expect(getSharedStore).toHaveBeenCalledTimes(2);
    const [firstStore, secondStore] = getSharedStore.mock.results.map(
      ({ value }) => value
    );
    expect(secondStore).not.toBe(firstStore);
    expect(reseed).toHaveBeenCalledTimes(1);
    expect(reseed.mock.calls[0][1]).toMatchObject({ keepScreen: false });

    clientC.disconnect();
    addTable(host, 'after rebinding');
    rename(host, kept, 'renamed after rebinding');
    addTable(c, 'offline in c');
    const writers = new Set(entriesOf(clientHost.doc).map(entry => entry.by));
    expect(writers.size).toBe(2);
    replica.compact();

    clientC.connect();
    expectConverged([host, c, server]);
    expect(tableNames(c)).toEqual([
      'after rebinding',
      'offline in c',
      'renamed after rebinding',
    ]);
    const late = harness.peer('late');
    harness.bind(late, harness.room.join().doc);
    expectConverged([host, late]);
    second.destroy();
    expect(destroyStore).toHaveBeenCalledTimes(2);
  });

  it('AC-P17 an element built before the store port raises error, and its shared store is let go', async () => {
    harness = createHarness();
    const host = harness.peer('host');
    const { element, getSharedStore, destroyStore } = fakeElement(host, {
      older: true,
    });
    const client = harness.room.join();
    const binding = bindErdEditor(element, client.doc);
    const errors = vi.fn();
    binding.on('error', errors);

    await Promise.resolve();
    expect(errors).toHaveBeenCalledTimes(1);
    expect(getSharedStore).toHaveBeenCalledTimes(1);
    expect(destroyStore).toHaveBeenCalledTimes(1);
    expect(binding.seed()).toBe(false);
    expect(client.doc.getMap('erd:snapshot').size).toBe(0);
  });
});

describe('portOfPeer', () => {
  it('AC-P17 needs each of the five port methods', () => {
    harness = createHarness();
    const peer = harness.peer('peer');
    const five = ['forgetPeer', 'getLWW', 'getVersion', 'mergeLWW', 'reseed'];
    const without = (name: string) =>
      ({ ...peer, [name]: undefined }) as unknown as PeerStore;
    expect([...PORT_METHODS].sort()).toEqual(five);
    expect(hasPortMethods(peer)).toBe(true);
    for (const name of five) {
      expect(hasPortMethods(without(name))).toBe(false);
      expect(portOfPeer(without(name))).toBeNull();
    }
    const port = portOfPeer(peer);
    expect(port?.editorId()).toBe(peer.editorId);
    expect(port?.closed()).toBe(false);
    port?.destroy();
    expect(peer.isDestroyed).toBe(false);
    peer.destroy();
    expect(port?.closed()).toBe(true);
  });
});
