import { afterEach, describe, expect, it } from 'vite-plus/test';

import { createTestAppContext, flush } from '@/__test-utils__';
import type { AppContext } from '@/components/appContext';
import { openTableGroupNameEditor } from '@/components/erd/canvas/table-group/tableGroupNameEditor';
import { Show } from '@/constants/schema';
import { focusTableAction } from '@/engine/modules/editor/atom.actions';
import { isEditingText } from '@/engine/modules/editor/state';
import { changeShowAction } from '@/engine/modules/settings/atom.actions';
import { addTableAction } from '@/engine/modules/table/atom.actions';
import { addTableGroupAction } from '@/engine/modules/table-group/atom.actions';

const RECT = { x: 0, y: 0, width: 600, height: 400 };

let app: AppContext;
let locked = false;

afterEach(() => {
  app?.store.destroy();
  locked = false;
});

function setup() {
  app = createTestAppContext({ getReadonly: () => locked });
  app.store.dispatchSync(
    addTableGroupAction({ id: 'g1', ui: { ...RECT, zIndex: 1 } }),
    addTableAction({ id: 't1', ui: { x: 40, y: 80, zIndex: 2 } })
  );
  return app;
}

describe('openTableGroupNameEditor', () => {
  it('opens the editor on the group, letting the table focus go', async () => {
    const { store } = setup();
    store.dispatchSync(focusTableAction({ tableId: 't1' }));

    openTableGroupNameEditor(store, 'g1');
    await flush();

    expect(store.state.editor.editTableGroupId).toBe('g1');
    expect(store.state.editor.focusTable).toBeNull();
  });

  it('opens nothing under a readonly store', async () => {
    const { store } = setup();
    locked = true;

    openTableGroupNameEditor(store, 'g1');
    await flush();

    expect(store.state.editor.editTableGroupId).toBeNull();
  });

  it('opens nothing while groups are hidden, which no editor would stand over', async () => {
    const { store } = setup();
    store.dispatchSync(
      changeShowAction({ show: Show.hideTableGroup, value: true })
    );

    openTableGroupNameEditor(store, 'g1');
    await flush();

    expect(store.state.editor.editTableGroupId).toBeNull();
    expect(isEditingText(store.state.editor)).toBe(false);
  });
});
