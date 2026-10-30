import '@dineug/erd-editor/erd-editor.js';

import type { ErdEditorElement } from '@dineug/erd-editor';
import {
  applyAwarenessUpdate,
  Awareness,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness';
import { WebsocketProvider } from 'y-websocket';
import * as Y from 'yjs';

import { bindErdEditor, type ErdYjsBinding } from '@/index';

const params = new URLSearchParams(location.search);

/** The Playwright suite's page: one editor, no seed of its own, and the handles the suite drives. */
const E2E = params.has('e2e');

const toolbar = document.getElementById('toolbar')!;
const app = document.getElementById('app')!;

/** The tag on what the direct link applies, which it never relays back. */
const LINK = Symbol('link');

type AwarenessChanges = {
  added: number[];
  updated: number[];
  removed: number[];
};

type Side = { doc: Y.Doc; awareness: Awareness };

function createEditor(): ErdEditorElement {
  const editor = document.createElement('erd-editor');
  editor.setAttribute(
    'style',
    'display: block; flex: 1; min-width: 0; height: 100%;'
  );
  if (E2E) {
    editor.systemDarkMode = false;
    editor.enableThemeBuilder = false;
    editor.enableLocalePicker = false;
    editor.enableWelcomeScreen = false;
  }
  app.appendChild(editor);
  return editor;
}

function addToggle(label: () => string, toggle: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  const render = () => {
    button.textContent = label();
  };
  button.addEventListener('click', () => {
    toggle();
    render();
  });
  render();
  toolbar.appendChild(button);
  return render;
}

function addLabel(text: string): HTMLSpanElement {
  const label = document.createElement('span');
  label.textContent = text;
  toolbar.appendChild(label);
  return label;
}

const reportErrors = (binding: ErdYjsBinding) =>
  binding.on('error', error => console.error(error));

/**
 * Joins two documents and their presence directly, every update applied to
 * the other side as it happens. Cut, neither hears the other; restored, each
 * takes what the other made meanwhile, as a provider's resync does.
 */
function createLink(a: Side, b: Side) {
  let online = true;

  const relay = (from: Side, to: Side) => {
    from.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (online && origin !== LINK) Y.applyUpdate(to.doc, update, LINK);
    });
    from.awareness.on(
      'update',
      ({ added, updated, removed }: AwarenessChanges, origin: unknown) => {
        if (!online || origin === LINK) return;
        const changed = added.concat(updated, removed);
        const update = encodeAwarenessUpdate(from.awareness, changed);
        applyAwarenessUpdate(to.awareness, update, LINK);
      }
    );
  };
  relay(a, b);
  relay(b, a);

  return {
    get online() {
      return online;
    },
    disconnect: () => {
      if (!online) return;
      online = false;
      removeAwarenessStates(a.awareness, [b.doc.clientID], LINK);
      removeAwarenessStates(b.awareness, [a.doc.clientID], LINK);
    },
    connect: () => {
      if (online) return;
      online = true;
      const toB = Y.encodeStateAsUpdate(a.doc, Y.encodeStateVector(b.doc));
      const toA = Y.encodeStateAsUpdate(b.doc, Y.encodeStateVector(a.doc));
      Y.applyUpdate(b.doc, toB, LINK);
      Y.applyUpdate(a.doc, toA, LINK);
      // Each side dropped the other at the clock it last heard, so each
      // renews its own state for the other to take it again.
      a.awareness.setLocalState(a.awareness.getLocalState());
      b.awareness.setLocalState(b.awareness.getLocalState());
    },
  };
}

function openPair() {
  const sides = ['left', 'right'].map(nickname => {
    const doc = new Y.Doc();
    const awareness = new Awareness(doc);
    const editor = createEditor();
    const binding = bindErdEditor(editor, doc, {
      awareness,
      getNickname: () => nickname,
    });
    reportErrors(binding);
    return { doc, awareness, binding };
  });
  const [left, right] = sides;
  const link = createLink(left, right);
  left.binding.seed();

  addLabel('Two editors, two Y.Docs');
  const status = addLabel('');
  const renderStatus = () => {
    status.textContent = link.online ? 'linked' : 'cut';
  };
  renderStatus();
  addToggle(
    () => (link.online ? 'Disconnect' : 'Connect'),
    () => {
      link.online ? link.disconnect() : link.connect();
      renderStatus();
    }
  );
}

const whenSynced = (provider: WebsocketProvider) =>
  new Promise<void>(resolve => {
    const onSync = (synced: boolean) => {
      if (!synced) return;
      provider.off('sync', onSync);
      resolve();
    };
    provider.on('sync', onSync);
  });

async function openRoom(room: string, url: string) {
  const doc = new Y.Doc();
  // Every update goes through the server, so a second tab of this page is a
  // client of the room like any other rather than a shortcut beside it.
  const provider = new WebsocketProvider(url, room, doc, { disableBc: true });

  addLabel(`Room ${room}`);
  const status = addLabel('connecting');
  provider.on('status', ({ status: next }) => {
    status.textContent = next;
  });
  const renderToggle = addToggle(
    () => (provider.shouldConnect ? 'Disconnect' : 'Connect'),
    () => (provider.shouldConnect ? provider.disconnect() : provider.connect())
  );

  await whenSynced(provider);
  renderToggle();

  const nickname = params.get('nickname') ?? `guest ${doc.clientID % 1000}`;
  const editor = createEditor();
  const binding = bindErdEditor(editor, doc, {
    awareness: provider.awareness,
    getNickname: () => nickname,
  });
  reportErrors(binding);

  if (E2E) {
    Reflect.set(window, '__erdYjs', { editor, provider, binding });
  } else {
    // An empty room opens on this editor's document; a seeded one refuses it.
    binding.seed();
  }
}

const room = params.get('room');
const url = params.get('ws');

if (room && url) {
  void openRoom(room, url);
} else {
  openPair();
}
