import { toDocumentJson, toJson } from '@dineug/erd-editor-schema';
import { afterEach, describe, expect, it } from 'vite-plus/test';

import { Database, Language, LockSettingType } from '@/constants/schema';
import { Clock } from '@/engine/clock';
import {
  documentJsonOf,
  runtimeJsonOf,
  withScreenBaseline,
} from '@/engine/documentJson';
import {
  changeDatabaseAction,
  changeLanguageAction,
  changeLockSettingsAction,
  scrollToAction,
} from '@/engine/modules/settings/atom.actions';
import { createStore, Store } from '@/engine/store';
import { attachActionTag, Tag } from '@/engine/tag';

const stores: Store[] = [];

function make(): Store {
  const store = createStore({
    toWidth: text => text.length * 10,
    clock: new Clock(),
  });
  stores.push(store);
  // Unlocked, so what the screen holds would reach both forms.
  store.dispatchSync(
    changeLockSettingsAction({
      lockSettingType:
        LockSettingType.viewport |
        LockSettingType.language |
        LockSettingType.canvasType,
      value: false,
      values: {},
    })
  );
  return store;
}

afterEach(() => {
  stores.splice(0).forEach(store => store.destroy());
});

describe('withScreenBaseline', () => {
  it('hands the state itself back while no screen is held', () => {
    const store = make();

    expect(withScreenBaseline(store.state)).toBe(store.state);
    expect(documentJsonOf(store)).toBe(toDocumentJson(store.state));
    expect(runtimeJsonOf(store)).toBe(toJson(store.state));
  });

  it('puts the document’s value of each unit held back on a copy of the settings', () => {
    const store = make();
    const before = {
      value: documentJsonOf(store),
      runtimeValue: runtimeJsonOf(store),
    };

    store.dispatchSync(
      attachActionTag(
        Tag.screen,
        scrollToAction({ originX: 40, originY: -40 })
      ),
      attachActionTag(
        Tag.screen,
        changeLanguageAction({ value: Language.Kotlin })
      ),
      attachActionTag(
        Tag.screen,
        changeDatabaseAction({ value: Database.PostgreSQL })
      )
    );
    const held = withScreenBaseline(store.state);

    expect(held.settings).toMatchObject({
      originX: 0,
      originY: 0,
      zoomLevel: 1,
      language: Language.GraphQL,
      database: Database.MySQL,
    });
    expect(held.settings).not.toBe(store.state.settings);
    expect(held.doc).toBe(store.state.doc);
    expect(store.state.settings).toMatchObject({
      originX: 40,
      language: Language.Kotlin,
    });
    expect(documentJsonOf(store)).toBe(before.value);
    expect(runtimeJsonOf(store)).toBe(before.runtimeValue);
    expect(toDocumentJson(store.state)).not.toBe(before.value);
  });
});
