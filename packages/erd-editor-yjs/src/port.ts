import type { ErdEditorElement } from '@dineug/erd-editor';
import type { PeerStore } from '@dineug/erd-editor/peer.js';

/** One action of a batch, as both stores hand it out and take it in. */
export type PortAction = Parameters<
  Parameters<PeerStore['subscribe']>[0]
>[0][number];

/** A store's registers, which a snapshot keeps beside its value and nothing here reads. */
export type Registers = ReturnType<PeerStore['getLWW']>;

export type ReseedOptions = Parameters<PeerStore['reseed']>[1];

/**
 * What the binding needs of a store, the element's shared store or a peer
 * store alike. Nothing outside it touches the store, so a transport reads no
 * state and decides no merge.
 */
export type CollaborationPort = {
  /** The editor id the store's batches carry, null until the element has sent one. */
  editorId: () => string | null;
  subscribe: (fn: (actions: PortAction[]) => void) => () => void;
  /** Applies another editor's batch at once. */
  receive: (actions: PortAction[]) => void;
  runtimeValue: () => string;
  setInitialValue: (value: string) => void;
  flushStreamBuffers: () => void;
  getLWW: () => Registers;
  getVersion: () => number;
  forgetPeer: (editorId: string) => void;
  reseed: (value: string, options: ReseedOptions) => void;
  /** Whether the caller destroyed the store under the binding, which only a peer store's can be. */
  closed: () => boolean;
  /** Lets go of what the port itself made: the element's shared store, nothing of a peer store. */
  destroy: () => void;
};

/** The methods an editor built before the store port lacks. */
export const PORT_METHODS = [
  'getLWW',
  'mergeLWW',
  'getVersion',
  'forgetPeer',
  'reseed',
] as const;

export const hasPortMethods = (store: object): boolean =>
  PORT_METHODS.every(name => typeof Reflect.get(store, name) === 'function');

/** The id the outbound pipe stamps on every action of a batch it sends. */
const editorIdOf = (actions: PortAction[]): unknown =>
  actions[0]?.meta?.editorId;

export type EditorPortConfig = {
  getNickname?: () => string;
  /** Turns on the element's cursor and focus trackers, which only Awareness carries. */
  presence: boolean;
};

/**
 * Takes one shared store from the element and lets it go again on destroy.
 * Null when the store lacks a port method, the store already let go.
 */
export function portOfEditor(
  editor: ErdEditorElement,
  { getNickname, presence }: EditorPortConfig
): CollaborationPort | null {
  const store = editor.getSharedStore({
    ...(getNickname ? { getNickname } : {}),
    mouseTracker: presence,
    focusTracker: presence,
  });
  if (!hasPortMethods(store)) {
    store.destroy();
    return null;
  }

  let editorId: string | null = null;

  return {
    editorId: () => editorId,
    subscribe: fn =>
      store.subscribe(actions => {
        const id = editorIdOf(actions);
        if (typeof id === 'string') editorId = id;
        fn(actions);
      }),
    receive: actions => store.dispatchSync(actions),
    runtimeValue: () => editor.runtimeValue,
    setInitialValue: value => editor.setInitialValue(value),
    flushStreamBuffers: () => store.flushStreamBuffers(),
    getLWW: () => store.getLWW(),
    getVersion: () => store.getVersion(),
    forgetPeer: id => store.forgetPeer(id),
    reseed: (value, options) => store.reseed(value, options),
    closed: () => false,
    destroy: () => store.destroy(),
  };
}

/** The peer store as it is: the caller made it, so the port never lets it go. */
export function portOfPeer(peer: PeerStore): CollaborationPort | null {
  if (!hasPortMethods(peer)) return null;

  return {
    editorId: () => peer.editorId,
    subscribe: fn => peer.subscribe(fn),
    receive: actions => peer.receive(actions),
    runtimeValue: () => peer.runtimeValue,
    setInitialValue: value => peer.setInitialValue(value),
    flushStreamBuffers: () => peer.flushStreamBuffers(),
    getLWW: () => peer.getLWW(),
    getVersion: () => peer.getVersion(),
    forgetPeer: id => peer.forgetPeer(id),
    reseed: (value, options) => peer.reseed(value, options),
    closed: () => peer.isDestroyed,
    destroy: () => {},
  };
}
