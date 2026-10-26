import { AnyAction, compositionActionsFlat } from '@dineug/r-html';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Clock } from '@/engine/clock';
import { EngineContext } from '@/engine/context';
import { GeneratorAction } from '@/engine/generator.actions';
import {
  dragstartColumnAction,
  focusColumnAction,
  focusTableAction,
  selectAction,
} from '@/engine/modules/editor/atom.actions';
import {
  dragoverColumnAction$,
  drawStartAddRelationshipAction$,
  duplicateAction$,
  pasteEntitiesAction$,
} from '@/engine/modules/editor/generator.actions';
import { FocusType, SelectType } from '@/engine/modules/editor/state';
import { addMemoAction } from '@/engine/modules/memo/atom.actions';
import { addMemoAction$ } from '@/engine/modules/memo/generator.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import {
  addTableAction$,
  pasteTableAction$,
} from '@/engine/modules/table/generator.actions';
import { addColumnAction } from '@/engine/modules/table-column/atom.actions';
import { addColumnAction$ } from '@/engine/modules/table-column/generator.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';
import {
  addTableGroupAction$,
  addTableGroupFromTablesAction$,
} from '@/engine/modules/table-group/generator.actions';
import { createRxStore, RxStore } from '@/engine/rx-store';
import { createStore, Store } from '@/engine/store';
import { createColumn } from '@/utils/collection/tableColumn.entity';
import { entitiesCopyToPayload } from '@/utils/table-clipboard/copy';

const ADD_TYPES = new Set([
  addTableAction.type,
  addMemoAction.type,
  addTableGroupAction.type,
  addColumnAction.type,
]);

const GROUP_RECT = { x: 0, y: 0, width: 600, height: 400 };

function createContext(): EngineContext {
  return { toWidth: (text: string) => text.length * 10, clock: new Clock() };
}

const stores: Array<Store | RxStore> = [];

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

const seedTable = (id: string, x = 100) =>
  addTableAction({ id, ui: { x, y: 100, zIndex: 2 } });

const seedMemo = (id: string) =>
  addMemoAction({ id, ui: { x: 700, y: 100, zIndex: 2 } });

/**
 * The ids a batch selects or focuses ahead of the add that creates them, and
 * how many times it reaches an id it creates at all, so a case that reaches
 * none proves nothing.
 */
function selectionOrder(actions: AnyAction[]) {
  const created = new Set(
    actions
      .filter(({ type }) => ADD_TYPES.has(type))
      .map(({ payload }) => payload.id as string)
  );
  const added = new Set<string>();
  const early: string[] = [];
  let reached = 0;

  const reach = (id: string) => {
    if (!created.has(id)) return;
    reached++;
    if (!added.has(id)) early.push(id);
  };

  for (const { type, payload } of actions) {
    if (ADD_TYPES.has(type)) {
      added.add(payload.id);
    } else if (type === selectAction.type) {
      Object.keys(payload).forEach(reach);
    } else if (type === focusTableAction.type) {
      reach(payload.tableId);
    } else if (type === focusColumnAction.type) {
      reach(payload.tableId);
      reach(payload.columnId);
    }
  }

  return { early, reached };
}

type OrderCase = [
  name: string,
  seed: (store: Store) => void,
  action: (store: Store) => GeneratorAction,
];

/**
 * Every engine generator that selects or focuses an entity it creates, over a
 * state that reaches it. Import and Add's landing, which composes the adds
 * outside the engine, keeps the same order under importSchema.test.ts.
 */
const ORDER_CASES: OrderCase[] = [
  ['addTableAction$', () => {}, () => addTableAction$()],
  ['addMemoAction$', () => {}, () => addMemoAction$()],
  [
    'addTableGroupAction$',
    store => store.dispatchSync(seedTable('t1')),
    () => addTableGroupAction$(GROUP_RECT),
  ],
  [
    'addTableGroupFromTablesAction$',
    store => store.dispatchSync(seedTable('t1')),
    () => addTableGroupFromTablesAction$(['t1']),
  ],
  [
    'duplicateAction$',
    store => store.dispatchSync(seedTable('t1'), seedMemo('m1')),
    () =>
      duplicateAction$({
        tableIds: ['t1'],
        memoIds: ['m1'],
        offset: { x: 40, y: 40 },
        escapeCollision: true,
      }),
  ],
  [
    'pasteEntitiesAction$',
    store =>
      store.dispatchSync(
        seedTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        seedMemo('m1'),
        selectAction({ t1: SelectType.table, m1: SelectType.memo })
      ),
    store => pasteEntitiesAction$(entitiesCopyToPayload(store.state)!, 1),
  ],
  [
    'addColumnAction$ on a table',
    store => store.dispatchSync(seedTable('t1')),
    () => addColumnAction$('t1'),
  ],
  [
    'addColumnAction$ over the selected tables',
    store =>
      store.dispatchSync(
        seedTable('t1'),
        seedTable('t2', 500),
        selectAction({ t1: SelectType.table, t2: SelectType.table })
      ),
    () => addColumnAction$(),
  ],
  [
    'pasteTableAction$ past the focused column',
    store =>
      store.dispatchSync(
        seedTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        focusColumnAction({
          tableId: 't1',
          columnId: 'c1',
          focusType: FocusType.columnName,
          $mod: false,
          shiftKey: false,
        })
      ),
    () =>
      pasteTableAction$([
        createColumn({ name: 'a' }),
        createColumn({ name: 'b' }),
      ]),
  ],
  [
    'drawStartAddRelationshipAction$ on a table with no key',
    store => store.dispatchSync(seedTable('t1')),
    () => drawStartAddRelationshipAction$('t1'),
  ],
  [
    'dragoverColumnAction$ into another table',
    store =>
      store.dispatchSync(
        seedTable('t1'),
        addColumnAction({ id: 'c1', tableId: 't1' }),
        seedTable('t2', 500),
        dragstartColumnAction({ tableId: 't1', columnIds: ['c1'] })
      ),
    () => dragoverColumnAction$(null, 't2'),
  ],
];

describe('a generator that selects or focuses what it creates', () => {
  it.each(ORDER_CASES)(
    '%s yields the add of each such id first',
    (_, seed, action) => {
      const store = createStore(createContext());
      stores.push(store);
      seed(store);

      const { early, reached } = selectionOrder(
        compositionActionsFlat(store.state, store.context, [
          action(store),
        ]) as AnyAction[]
      );

      expect(reached).toBeGreaterThan(0);
      expect(early).toEqual([]);
    }
  );
});

describe('a readonly editor store, which drops the add of a new entity', () => {
  /** The adds the readonly filter drops, each of which selects what it adds. */
  const ADD_CASES: Array<[name: string, action: () => GeneratorAction]> = [
    ['addTableAction$', () => addTableAction$()],
    ['addMemoAction$', () => addMemoAction$()],
    ['addTableGroupAction$', () => addTableGroupAction$(GROUP_RECT)],
    [
      'addTableGroupFromTablesAction$',
      () => addTableGroupFromTablesAction$(['t1']),
    ],
    [
      'duplicateAction$',
      () =>
        duplicateAction$({
          tableIds: ['t1'],
          memoIds: ['m1'],
          offset: { x: 40, y: 40 },
          escapeCollision: true,
        }),
    ],
  ];

  function setup(readonly: boolean) {
    let isReadonly = false;
    const store = createRxStore(createContext(), {
      getReadonly: () => isReadonly,
      readonlyEditState: true,
    });
    stores.push(store);
    store.dispatchSync(
      seedTable('t1'),
      seedMemo('m1'),
      selectAction({ t1: SelectType.table })
    );
    isReadonly = readonly;
    return store;
  }

  const listedIds = ({ doc }: RxStore['state']) => [
    ...doc.tableIds,
    ...doc.memoIds,
    ...doc.tableGroupIds,
  ];

  it.each(ADD_CASES)(
    '%s adds nothing and leaves no id it made selected',
    (_, action) => {
      const store = setup(true);

      store.dispatchSync(action());

      const { state } = store;
      expect(listedIds(state)).toEqual(['t1', 'm1']);
      expect({ ...state.editor.selectedMap }).toEqual({});
      expect(state.editor.focusTable).toBeNull();
    }
  );

  it.each(ADD_CASES)(
    '%s still selects what it adds while writable',
    (_, action) => {
      const store = setup(false);

      store.dispatchSync(action());

      const created = listedIds(store.state).filter(
        id => id !== 't1' && id !== 'm1'
      );
      expect(created.length).toBeGreaterThan(0);
      expect(Object.keys(store.state.editor.selectedMap).sort()).toEqual(
        created.sort()
      );
    }
  );
});
