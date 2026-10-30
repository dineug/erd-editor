// A real element rejoining a session through the shared store a host holds:
// its screen stays, hidden and shown again included, one never shown opens as
// a late joiner does, and a rejoin or an initial value closes an open edit.

import type { AnyAction } from '@dineug/r-html';
import { cloneDeep } from 'es-toolkit';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { userEvent } from 'vite-plus/test/browser/context';

import { flush } from '@/__test-utils__/index';
import { SEED } from '@/__test-utils__/peerSeed';
import {
  createLockOffValue,
  drawn,
  openLockOffEditor,
} from '@/__test-utils__/readonlyEditor';
import type { ErdEditorElement } from '@/components/erd-editor/ErdEditor';
import { CanvasType, NameViewMode, RelationshipType } from '@/constants/schema';
import {
  drawStartAddRelationshipAction,
  drawStartRelationshipAction,
  editMemoAction,
  editTableAction,
  editTableGroupAction,
  focusColumnAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import {
  changeCanvasTypeAction,
  changeNameViewModeAction,
  changeZoomLevelAction,
  scrollToAction,
  streamScrollToAction,
} from '@/engine/modules/settings/atom.actions';
import {
  changeTableNameAction,
  removeTableAction,
} from '@/engine/modules/table/atom.actions';
import {
  changeColumnLogicalNameAction,
  changeColumnNameAction,
} from '@/engine/modules/table-column/atom.actions';
import { changeTableGroupNameAction } from '@/engine/modules/table-group/atom.actions';
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

type Bound = ReturnType<typeof bind>;

/** The two loads that open a document over the one open: a rejoin's and a host's. */
const LOADS: Array<
  [string, (el: ErdEditorElement, bound: Bound, peer: PeerStore) => void]
> = [
  [
    'a reseed',
    (_el, { sharedStore }, peer) =>
      sharedStore.reseed(peer.runtimeValue, snapshotOf(peer)),
  ],
  [
    'setInitialValue',
    (el, _bound, peer) => el.setInitialValue(peer.runtimeValue),
  ],
];

/** The cell editor's input, a logical name's among them. */
const CELL_INPUT = '.edit-overlay input.edit-input';

/**
 * The two editors that write as they are typed in, each with how it opens,
 * where it shows and the loads that close it here: a reseed ends the focus,
 * which closed a cell before any load did, so the cell's case is setInitialValue's.
 */
const TYPED_EDITORS = [
  {
    name: 'the memo body editor',
    selector: '.memo-textarea',
    open: () => [editMemoAction({ id: SEED.memo })],
    loads: ['a reseed', 'setInitialValue'],
  },
  {
    name: 'the cell editor',
    selector: CELL_INPUT,
    open: () => [
      focusTableAction({
        tableId: SEED.orders,
        focusType: FocusType.tableName,
      }),
      editTableAction(),
    ],
    loads: ['setInitialValue'],
  },
];

const sentTypesOf = ({ sent }: Bound) => sent.flat().map(({ type }) => type);

/**
 * The three editors that hold the keyboard, each opened over what it selects,
 * which a Delete or a Backspace would remove from the root the keyboard went
 * back to, and where the file lists that entity.
 */
const KEYBOARD_EDITORS = [
  {
    name: 'the memo body editor',
    selector: '.memo-textarea',
    open: () => [
      selectAction({ [SEED.memo]: SelectType.memo }),
      editMemoAction({ id: SEED.memo }),
    ],
    listed: (value: string): string[] => JSON.parse(value).doc.memoIds ?? [],
    id: SEED.memo,
  },
  {
    name: 'the cell editor',
    selector: CELL_INPUT,
    open: () => [
      selectAction({ [SEED.orders]: SelectType.table }),
      focusTableAction({
        tableId: SEED.orders,
        focusType: FocusType.tableName,
      }),
      editTableAction(),
    ],
    listed: (value: string): string[] => JSON.parse(value).doc.tableIds ?? [],
    id: SEED.orders,
  },
  {
    name: 'the group name editor',
    selector: '.table-group-name-input',
    open: () => [
      selectAction({ [SEED.group]: SelectType.tableGroup }),
      editTableGroupAction({ id: SEED.group }),
    ],
    listed: (value: string): string[] =>
      JSON.parse(value).doc.tableGroupIds ?? [],
    id: SEED.group,
  },
];

/** Whether some node of the element shows a relationship draw's cursor. */
const drawCursorShown = (shadow: ShadowRoot) =>
  Array.from(shadow.querySelectorAll<HTMLElement>('*')).some(node =>
    node.style?.cursor.startsWith('url(')
  );

describe.each(LOADS)(
  '<erd-editor> closing the edits open at %s',
  (label, load) => {
    it.each(TYPED_EDITORS.filter(({ loads }) => loads.includes(label)))(
      'closes $name, sending nothing of it',
      async ({ selector, open }) => {
        const el = await openLockOffEditor({ readonly: false });
        const bound = bind(el);
        const peer = peerOf(el);
        const shadow = el.shadowRoot as ShadowRoot;
        bound.sharedStore.dispatchSync(open());
        await drawn();
        expect(shadow.querySelector(selector)).not.toBeNull();
        bound.sent.splice(0);

        load(el, bound, peer);
        await drawn();

        expect(shadow.querySelector(selector)).toBeNull();
        expect(sentTypesOf(bound)).toEqual(['editor.getLWW']);
      }
    );

    it.each(KEYBOARD_EDITORS)(
      'hands the keyboard to nothing as it closes $name, so the next Backspace removes nothing',
      async ({ selector, open, listed, id }) => {
        const el = await openLockOffEditor({ readonly: false });
        const bound = bind(el);
        const peer = peerOf(el);
        const shadow = el.shadowRoot as ShadowRoot;
        bound.sharedStore.dispatchSync(open());
        await drawn();
        expect(shadow.activeElement).toBe(shadow.querySelector(selector));
        bound.sent.splice(0);

        load(el, bound, peer);
        await drawn();
        expect(shadow.querySelector(selector)).toBeNull();
        expect(document.activeElement).not.toBe(el);
        await userEvent.keyboard('{Backspace}');
        await drawn();

        expect(listed(el.value)).toContain(id);
        expect(sentTypesOf(bound)).toEqual(['editor.getLWW']);
      }
    );

    it.each([
      ['a name typed into it', 'typed', null],
      [
        'the name it opened with, over a rename a peer made since',
        null,
        'renamed by the peer',
      ],
    ])(
      'closes the group name editor, writing nothing of %s',
      async (_case, typed, renamed) => {
        const el = await openLockOffEditor({ readonly: false });
        const bound = bind(el);
        const shadow = el.shadowRoot as ShadowRoot;
        bound.sharedStore.dispatchSync(
          editTableGroupAction({ id: SEED.group })
        );
        await drawn();
        const input = shadow.querySelector<HTMLInputElement>(
          '.table-group-name-input'
        );
        expect(input?.value).toBe('accounts');
        if (typed !== null) input!.value = typed;
        const peer = peerOf(el);
        if (renamed !== null) {
          peer.dispatch([
            changeTableGroupNameAction({ id: SEED.group, value: renamed }),
          ]);
        }
        bound.sent.splice(0);

        load(el, bound, peer);
        await drawn();

        expect(shadow.querySelector('.table-group-name-input')).toBeNull();
        expect(
          JSON.parse(el.value).collections.tableGroupEntities[SEED.group].name
        ).toBe(renamed ?? 'accounts');
        expect(sentTypesOf(bound)).toEqual(['editor.getLWW']);
      }
    );

    it('closes a logical name cell over a logical name a peer changed, deriving no name from it', async () => {
      const el = await openLockOffEditor({ readonly: false });
      const bound = bind(el);
      const shadow = el.shadowRoot as ShadowRoot;
      bound.sharedStore.dispatchSync([
        changeNameViewModeAction({
          value: NameViewMode.both,
          shared: true,
          editorId: '',
        }),
        focusTableAction({ tableId: SEED.orders }),
        focusColumnAction({
          tableId: SEED.orders,
          columnId: SEED.orderNote,
          focusType: FocusType.columnLogicalName,
          $mod: false,
          shiftKey: false,
        }),
        editTableAction(),
      ]);
      await drawn();
      expect(shadow.querySelector(CELL_INPUT)).not.toBeNull();
      // The peer empties the name, which a derive would then write, and sets a term's logical name.
      const peer = peerOf(el);
      peer.dispatch([
        changeColumnNameAction({
          tableId: SEED.orders,
          id: SEED.orderNote,
          value: '',
        }),
        changeColumnLogicalNameAction({
          tableId: SEED.orders,
          id: SEED.orderNote,
          value: 'Member Name',
        }),
      ]);
      bound.sent.splice(0);

      load(el, bound, peer);
      await drawn();

      expect(shadow.querySelector(CELL_INPUT)).toBeNull();
      const column = JSON.parse(el.value).collections.tableColumnEntities[
        SEED.orderNote
      ];
      expect(column.logicalName).toBe('Member Name');
      // The file form leaves an empty name out.
      expect(column.name ?? '').toBe('');
      expect(sentTypesOf(bound)).toEqual(['editor.getLWW']);
    });

    it('ends the relationship draw from a table a peer removed, its cursor with it', async () => {
      const el = await openLockOffEditor({ readonly: false });
      const bound = bind(el);
      const peer = peerOf(el);
      const shadow = el.shadowRoot as ShadowRoot;
      bound.sharedStore.dispatchSync([
        drawStartRelationshipAction({
          relationshipType: RelationshipType.OneN,
        }),
        drawStartAddRelationshipAction({ tableId: SEED.users }),
      ]);
      peer.dispatch([removeTableAction({ id: SEED.users })]);
      await drawn();
      expect(drawCursorShown(shadow)).toBe(true);
      bound.sent.splice(0);

      load(el, bound, peer);
      await drawn();

      expect(drawCursorShown(shadow)).toBe(false);
      expect(sentTypesOf(bound)).toEqual(['editor.getLWW']);
    });
  }
);
