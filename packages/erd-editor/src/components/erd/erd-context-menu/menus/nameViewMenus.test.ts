import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  createTestAppContext,
  flush,
  pseudoMessages,
} from '@/__test-utils__/index';
import { AppContext } from '@/components/appContext';
import { createNameViewMenus } from '@/components/erd/erd-context-menu/menus/nameViewMenus';
import { nameViewOptions } from '@/components/erd/nameViewOptions';
import { LockSettingType, NameViewMode } from '@/constants/schema';
import { changeNameViewModeAction } from '@/engine/modules/settings/atom.actions';
import { changeLockSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

let app: AppContext;
let readonly = false;

beforeEach(() => {
  readonly = false;
  app = createTestAppContext({ getReadonly: () => readonly });
});

afterEach(() => {
  app.store.destroy();
});

const NAMES = ['Physical Names', 'Logical Names', 'Both Names'];

const unlockNameView = () => {
  app.store.dispatchSync(
    changeLockSettingsAction$(LockSettingType.unlockNameViewMode, false)
  );
};

const pick = (name: string) =>
  createNameViewMenus(app, sourceI18n)
    .find(menu => menu.name === name)
    ?.onClick();

/** The name view switches the store sends while each of the rows is picked. */
function recordSwitches() {
  const switches: unknown[] = [];
  app.store.subscribe(actions => {
    for (const action of actions) {
      if (action.type === changeNameViewModeAction.type) {
        switches.push(action.payload);
      }
    }
  });
  return switches;
}

describe('nameViewMenus', () => {
  it('lists the three views in order, each named in the language it is handed', () => {
    expect(nameViewOptions.map(menu => menu.value)).toEqual([
      NameViewMode.physical,
      NameViewMode.logical,
      NameViewMode.both,
    ]);
    expect(createNameViewMenus(app).map(menu => menu.name)).toEqual(NAMES);
    expect(
      createNameViewMenus(app, createI18n('ko-KR', pseudoMessages('ko'))).map(
        menu => menu.name
      )
    ).toEqual(NAMES.map(name => `ko:${name}`));
  });

  it('checks the view in force alone, which a new document holds physical', async () => {
    const checked = () =>
      createNameViewMenus(app)
        .filter(menu => menu.checked)
        .map(menu => menu.name);
    expect(checked()).toEqual(['Physical Names']);

    pick('Logical Names');
    await flush();

    expect(app.store.state.settings.nameViewMode).toBe(NameViewMode.logical);
    expect(checked()).toEqual(['Logical Names']);
  });

  it("switches the reader's own view while the lock holds it, the document's once it is off", async () => {
    const switches = recordSwitches();
    const { id } = app.store.state.editor;

    pick('Both Names');
    await flush();
    unlockNameView();
    pick('Logical Names');
    await flush();

    expect(switches).toEqual([
      { value: NameViewMode.both, shared: false, editorId: id },
      { value: NameViewMode.logical, shared: true, editorId: id },
    ]);
    expect(app.store.state.settings.nameViewMode).toBe(NameViewMode.logical);
  });

  it('switches a readonly reader its own view though the lock is off', async () => {
    unlockNameView();
    readonly = true;
    const switches = recordSwitches();

    pick('Both Names');
    await flush();

    expect(switches).toEqual([
      {
        value: NameViewMode.both,
        shared: false,
        editorId: app.store.state.editor.id,
      },
    ]);
    expect(app.store.state.settings.nameViewMode).toBe(NameViewMode.both);
  });
});
