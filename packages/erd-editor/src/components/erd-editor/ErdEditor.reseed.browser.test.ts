// A real element rejoining a session through the shared store a host holds:
// the reader's screen stays where it stood, hidden and shown again included,
// one never shown opens as a late joiner does, and the value is the snapshot's.

import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { flush } from '@/__test-utils__/index';
import { SEED } from '@/__test-utils__/peerSeed';
import {
  createLockOffValue,
  drawn,
  openLockOffEditor,
} from '@/__test-utils__/readonlyEditor';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import { CanvasType } from '@/constants/schema';
import {
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import {
  changeCanvasTypeAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { changeTableNameAction } from '@/engine/modules/table/atom.actions';
import { createPeerStore, type PeerStore } from '@/engine/peer-store';

const teardowns: Array<() => void> = [];

afterEach(() => {
  teardowns.splice(0).forEach(teardown => teardown());
});

/** Where the reader's screen stands as the snapshot arrives. */
const SCREEN = { originX: -320, originY: -180, zoomLevel: 0.5 };

/** Far from every table, where a load's pull brings the origin back at the next measure. */
const FAR = { originX: -50000, originY: -50000 };

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()));

/** The element's shared store, as a host binds one, and every batch it sent. */
function bind(el: ErdEditorElement, { focusTracker = false } = {}) {
  const sharedStore = el.getSharedStore({
    mouseTracker: false,
    focusTracker,
  });
  const sent: AnyAction[][] = [];
  const unsubscribe = sharedStore.subscribe(actions =>
    sent.push(cloneDeep(actions))
  );
  teardowns.push(() => {
    unsubscribe();
    sharedStore.destroy();
    el.remove();
  });
  return { sharedStore, sent };
}

/** A peer on the element's document, which renames a table the element never hears of. */
function peerOf(el: ErdEditorElement): PeerStore {
  const peer = createPeerStore({ nickname: 'agent', presence: false });
  teardowns.push(peer.destroy);
  peer.setInitialValue(el.runtimeValue);
  peer.dispatch([changeTableNameAction({ id: SEED.users, value: 'theirs' })]);
  return peer;
}

const snapshotOf = (peer: PeerStore) => ({
  lww: peer.getLWW(),
  version: peer.getVersion(),
  keepScreen: true,
});

/** The file form with the units each element writes of its own screen left out. */
const outsideScreen = (value: string) => {
  const { settings, ...rest } = JSON.parse(value);
  const { originX, originY, zoomLevel, canvasType, ...kept } = settings;
  return { ...rest, settings: kept };
};

/** Pans the element once and hands back what it sent for the pan. */
async function panOnce(
  { sharedStore, sent }: ReturnType<typeof bind>,
  movementX: number
) {
  sent.splice(0);
  sharedStore.dispatchSync(streamScrollToAction({ movementX, movementY: 0 }));
  sharedStore.flushStreamBuffers();
  await flush();
  return sent.flat().map(({ type, payload }) => [type, payload]);
}

describe('<erd-editor> reseeded through its shared store', () => {
  it('keeps the screen and the tab it stood on, its value the snapshot’s, as a late joiner’s', async () => {
    const el = await openLockOffEditor({ readonly: false });
    const bound = bind(el);
    const peer = peerOf(el);
    bound.sharedStore.dispatchSync([
      scrollToAction({ originX: SCREEN.originX, originY: SCREEN.originY }),
      changeZoomLevelAction({ value: SCREEN.zoomLevel }),
    ]);
    bound.sharedStore.dispatchSync(
      changeCanvasTypeAction({ value: CanvasType.settings })
    );
    await drawn();
    bound.sent.splice(0);

    bound.sharedStore.reseed(peer.runtimeValue, snapshotOf(peer));
    await drawn();

    const shadow = el.shadowRoot as ShadowRoot;
    expect(
      shadow
        .querySelector('.toolbar [title="Settings"]')!
        .classList.contains('active')
    ).toBe(true);
    expect(bound.sent.flat().map(({ type }) => type)).toEqual([
      'editor.getLWW',
    ]);
    expect(
      JSON.parse(el.value).collections.tableEntities[SEED.users].name
    ).toBe('theirs');
    expect(outsideScreen(el.value)).toEqual(outsideScreen(peer.value));

    const joiner = await openLockOffEditor({ readonly: false });
    teardowns.push(() => joiner.remove());
    joiner.setInitialValue(peer.runtimeValue);
    await drawn();
    expect(el.value).toBe(joiner.value);

    expect(await panOnce(bound, 30)).toEqual([
      [
        'settings.scrollTo',
        { originX: SCREEN.originX, originY: SCREEN.originY },
      ],
      ['settings.changeZoomLevel', { value: SCREEN.zoomLevel }],
      [
        'settings.scrollTo',
        { originX: SCREEN.originX + 30, originY: SCREEN.originY },
      ],
    ]);
  });

  it('drops the selection and the focus, sending the presence it cleared beside the request for registers', async () => {
    const el = await openLockOffEditor({ readonly: false });
    const bound = bind(el, { focusTracker: true });
    const peer = peerOf(el);
    const sentTypes = () =>
      bound.sent
        .flat()
        .map(({ type }) => type)
        .sort();
    bound.sharedStore.dispatchSync([
      selectAction({ [SEED.users]: SelectType.table }),
      focusTableAction({ tableId: SEED.users, focusType: FocusType.tableName }),
    ]);
    // Presence leaves through its own throttle, which no flush reaches.
    await vi.waitFor(() =>
      expect(sentTypes()).toEqual(
        expect.arrayContaining([
          'editor.sharedFocusTracker',
          'editor.sharedSelectionTracker',
        ])
      )
    );
    bound.sent.splice(0);

    bound.sharedStore.reseed(peer.runtimeValue, snapshotOf(peer));

    await vi.waitFor(() =>
      expect(sentTypes()).toEqual([
        'editor.getLWW',
        'editor.sharedFocusTracker',
        'editor.sharedSelectionTracker',
      ])
    );
    const payloadOf = (type: string) =>
      bound.sent.flat().find(action => action.type === type)?.payload;
    expect(payloadOf('editor.sharedFocusTracker')).toEqual({ focus: null });
    expect(payloadOf('editor.sharedSelectionTracker')).toEqual({
      selectedIds: [],
    });
  });

  it('keeps the screen of an element hidden after a measure through the measure that shows it again', async () => {
    const el = await openLockOffEditor({ readonly: false });
    const bound = bind(el);
    const peer = peerOf(el);
    bound.sharedStore.dispatchSync(scrollToAction(FAR));
    el.style.display = 'none';
    await nextFrame();
    await drawn();

    bound.sharedStore.reseed(peer.runtimeValue, snapshotOf(peer));
    await flush();
    el.style.display = 'block';
    await nextFrame();
    await drawn();

    expect((await panOnce(bound, 30))[0]).toEqual(['settings.scrollTo', FAR]);
    expect(outsideScreen(el.value)).toEqual(outsideScreen(peer.value));
  });

  it('opens an element never shown at the rejoin where the value’s pull puts it, as a late joiner', async () => {
    const el = document.createElement('erd-editor');
    el.setAttribute('style', 'display: none; width: 1100px; height: 700px;');
    document.body.append(el);
    await flush();
    el.setInitialValue(createLockOffValue());
    await flush();
    const bound = bind(el);
    const peer = peerOf(el);
    // The pull the load left waiting takes the first measure, rejoin or not.
    bound.sharedStore.dispatchSync(scrollToAction(FAR));

    bound.sharedStore.reseed(peer.runtimeValue, snapshotOf(peer));
    await flush();
    el.style.display = 'block';
    await nextFrame();
    await drawn();

    const joiner = await openLockOffEditor({ readonly: false });
    const joinerBound = bind(joiner);
    joiner.setInitialValue(peer.runtimeValue);
    await drawn();
    expect(el.value).toBe(joiner.value);
    expect(await panOnce(bound, 30)).toEqual(await panOnce(joinerBound, 30));
  });
});
