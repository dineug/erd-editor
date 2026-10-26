import '@/erd-editor';

import { setSettingLock } from '@dineug/erd-editor-schema';
import type { AnyAction } from '@dineug/r-html';
import { whenDrawn } from '@dineug/r-html-konva';
import { cloneDeep } from 'es-toolkit';
import { expect, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import { flush } from '@/__test-utils__/index';
import { createSeedValue } from '@/__test-utils__/peerSeed';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import {
  BracketType,
  CanvasType,
  Database,
  Language,
  LockSettingTypeList,
  NameCase,
} from '@/constants/schema';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';
import type { SharedStore } from '@/engine/shared-store';

/** The settings the document opens on, which a reader's screen may turn and the document keeps. */
export const READONLY_SEED_SETTINGS = {
  canvasType: CanvasType.ERD,
  language: Language.TypeScript,
  database: Database.MySQL,
  tableNameCase: NameCase.pascalCase,
  columnNameCase: NameCase.camelCase,
  bracketType: BracketType.none,
  databaseName: 'shop',
  relationshipDataTypeSync: false,
  maxWidthComment: 120,
  ddlScripts: { before: 'SET NAMES utf8mb4;', after: '' },
};

/**
 * The peer seed with every lock off, so each setting a reader turns takes the
 * screen's own path rather than the one a locked setting takes.
 */
export function createLockOffValue(): string {
  const value = JSON.parse(createSeedValue());
  Object.assign(value.settings, READONLY_SEED_SETTINGS, {
    lockSettings: LockSettingTypeList.reduce(
      (bits, bit) => setSettingLock(bits, bit, false),
      value.settings.lockSettings ?? 0
    ),
  });
  return JSON.stringify(value);
}

export type ReadonlyEditor = {
  el: ErdEditorElement;
  shadow: ShadowRoot;
  /** Every batch the editor sent through the shared store a host takes. */
  sent: AnyAction[][];
  /** A writable peer on the same document, handed every batch the editor sent. */
  peer: PeerStore;
  /** The change events the element fired. */
  changes: Event[];
  /** Presses the toolbar's button of the tab its title names and waits for the tab to draw. */
  openTab: (title: string) => Promise<void>;
  /** Asserts that the file form, the runtime form and the peer still hold the document as it opened, and nothing left. */
  expectDocumentKept: () => Promise<void>;
};

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** Rendered, drawn and painted, twice over for what a draw schedules. */
export async function drawn() {
  for (let round = 0; round < 2; round++) {
    await flush();
    await whenDrawn();
    await nextFrame();
  }
}

/**
 * Past the change event's 200 ms debounce, which no signal outside the store
 * marks; the outbound pipe's two stream stages are flushed instead.
 */
const pastTheChangeWindow = () =>
  new Promise(resolve => setTimeout(resolve, 260));

const teardowns: Array<() => void> = [];

/** Takes down every editor opened since the last call, its shared store and peer with it. */
export function closeReadonlyEditors() {
  teardowns.splice(0).forEach(teardown => teardown());
}

/**
 * An editor as a host builds one, readonly unless told otherwise, its shadow
 * root opened so a spec presses its controls, over the lock-off seed, measured
 * at the size given. The spec that opens it removes it.
 */
export async function openLockOffEditor({
  readonly = true,
  width = 1100,
  height = 700,
} = {}): Promise<ErdEditorElement> {
  const attachShadow = Element.prototype.attachShadow;
  const opened = vi
    .spyOn(Element.prototype, 'attachShadow')
    .mockImplementation(function (this: Element, init: ShadowRootInit) {
      return attachShadow.call(this, { ...init, mode: 'open' });
    });

  const el = document.createElement('erd-editor');
  el.readonly = readonly;
  el.setAttribute(
    'style',
    `display: block; width: ${width}px; height: ${height}px;`
  );
  document.body.append(el);
  await flush();
  opened.mockRestore();
  el.setInitialValue(createLockOffValue());
  await drawn();
  return el;
}

/**
 * A readonly editor as a host builds one, its shadow root opened so a spec
 * presses its controls, over the lock-off seed, measured at the size given.
 */
export async function openReadonlyEditor({
  width = 1100,
  height = 700,
} = {}): Promise<ReadonlyEditor> {
  const el = await openLockOffEditor({ width, height });

  const sharedStore: SharedStore = el.getSharedStore({
    mouseTracker: false,
    focusTracker: false,
  });
  const peer = createPeerStore({ nickname: 'agent' });
  peer.setInitialValue(el.runtimeValue);
  const sent: AnyAction[][] = [];
  const unsubscribe = sharedStore.subscribe(actions => {
    sent.push(cloneDeep(actions));
    peer.receive(cloneDeep(actions));
  });
  // A host's first subscribe asks the other peers for their registers, which
  // is the join and nothing a reader did, so the record starts past it.
  await drawn();
  sent.splice(0);
  const changes: Event[] = [];
  const onChange = (event: Event) => changes.push(event);
  el.addEventListener('change', onChange);

  const value = el.value;
  const runtimeValue = el.runtimeValue;
  const peerValue = peer.value;
  const shadow = el.shadowRoot as ShadowRoot;

  teardowns.push(() => {
    el.removeEventListener('change', onChange);
    unsubscribe();
    sharedStore.destroy();
    peer.destroy();
    el.remove();
  });

  return {
    el,
    shadow,
    sent,
    peer,
    changes,
    openTab: async title => {
      const button = shadow.querySelector(`.toolbar [title="${title}"]`);
      expect(button, title).not.toBeNull();
      await userEvent.click(button!);
      await drawn();
    },
    expectDocumentKept: async () => {
      await pastTheChangeWindow();
      await drawn();
      // A pan or a zoom the pipe still holds would reach the peer only after
      // both of its 200 ms stages, so it is sent now, and the peer takes it.
      sharedStore.flushStreamBuffers();

      expect(el.value).toBe(value);
      expect(el.runtimeValue).toBe(runtimeValue);
      expect(peer.value).toBe(peerValue);
      expect(sent).toEqual([]);
      expect(changes).toEqual([]);
    },
  };
}
