import { toJson } from '@dineug/erd-editor-schema';
import { observable, onMounted, Ref, watch } from '@dineug/r-html';
import { arrayHas, isArray, isString } from '@dineug/shared';
import { cloneDeep, omit } from 'es-toolkit';
import { get, isEmpty } from 'es-toolkit/compat';

import { AppContext, appDestroy } from '@/components/appContext';
import { DatabaseVendorToDatabase } from '@/constants/sql/database';
import {
  clearAction,
  initialClearAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  loadJsonAction$,
  loadSchemaDBMLAction$,
  loadSchemaGraphQLAction$,
  loadSchemaSQLAction$,
} from '@/engine/modules/editor/generator.actions';
import { createSharedStore, SharedStore } from '@/engine/shared-store';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useUnmounted } from '@/hooks/useUnmounted';
import { Unsubscribe } from '@/internal-types';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceList,
  createTheme,
  GrayColor,
  GrayColorList,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { Theme, ThemeTokens } from '@/themes/tokens';
import {
  mouseTrackerEndAction,
  mouseTrackerStartAction,
  openDiffViewerAction,
  schemaGCAction,
} from '@/utils/emitter';
import { KeyBindingName, KeyBindingNameList } from '@/utils/keyboard-shortcut';
import { createSchemaSQL } from '@/utils/schema-sql';
import { hasDatabaseVendor, toSafeString } from '@/utils/validation';

import { ErdEditorElement, ErdEditorProps } from './ErdEditor';

const hasOmitKeyBindingName = arrayHas<string>([
  KeyBindingName.edit,
  KeyBindingName.stop,
  KeyBindingName.search,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
]);

const ExternalKeyBindingNameList = KeyBindingNameList.filter(
  key => !hasOmitKeyBindingName(key)
);

const defaultThemeOptions: ThemeOptions = {
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.dark,
} as const;

const hasGrayColor = arrayHas<string>(GrayColorList);
const hasAccentColor = arrayHas<string>(AccentColorList);
const hasAppearance = arrayHas<string>(AppearanceList);

type Props = {
  props: ErdEditorProps;
  ctx: ErdEditorElement;
  app: AppContext;
  root: Ref<HTMLDivElement>;
};

export function useErdEditorAttachElement({ props, ctx, app, root }: Props) {
  const { store, keyBindingMap, emitter, shortcut$, keydown$ } = app;
  const getReadonly = () => props.readonly;
  const themeState = observable<{
    options: ThemeOptions;
    preset: Theme;
    custom: Partial<Theme>;
  }>({
    options: { ...defaultThemeOptions },
    preset: createTheme(defaultThemeOptions),
    custom: {},
  });

  const theme = observable<Theme>(
    {
      ...themeState.preset,
      ...themeState.custom,
    },
    { shallow: true }
  );

  const darkMode = useDarkMode();
  const { addUnsubscribe } = useUnmounted();
  const sharedStoreSet = new Set<SharedStore>();

  const emitChange = () => {
    getReadonly() || ctx.dispatchEvent(new CustomEvent('change'));
  };

  const destroySet = new Set<Unsubscribe>([
    watch(props).subscribe(propName => {
      if (propName !== 'systemDarkMode' || !props.systemDarkMode) {
        return;
      }

      themeState.options.appearance = darkMode.state.isDark
        ? Appearance.dark
        : Appearance.light;
    }),
    watch(darkMode.state).subscribe(propName => {
      if (propName !== 'isDark' || !props.systemDarkMode) {
        return;
      }

      themeState.options.appearance = darkMode.state.isDark
        ? Appearance.dark
        : Appearance.light;
    }),
    watch(themeState.options).subscribe(() => {
      Object.assign(themeState.preset, createTheme(themeState.options));
    }),
    watch(themeState.preset).subscribe(() => {
      Object.assign(theme, themeState.preset, themeState.custom);
    }),
    watch(themeState).subscribe(propName => {
      if (propName !== 'custom') return;

      Object.assign(theme, themeState.preset, themeState.custom);
    }),
  ]);

  onMounted(() => {
    addUnsubscribe(
      store.change$.subscribe(emitChange),
      emitter.on({
        setThemeOptions: ({ payload }) => {
          ctx.setPresetTheme(payload);
          ctx.dispatchEvent(
            new CustomEvent('changePresetTheme', {
              detail: cloneDeep(themeState.options),
            })
          );
        },
      })
    );
  });

  // `focus`/`blur` shadow HTMLElement.prototype methods. Environments that patch those
  // methods can leave them as getter-only accessors on the prototype — Storybook's preview
  // runtime does, via @testing-library/user-event — and a plain assignment then throws in
  // strict mode. Defining own properties skips the prototype setter lookup entirely.
  Object.defineProperties(ctx, {
    focus: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: () => {
        root.value?.focus();
      },
    },
    blur: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: () => {
        ctx.focus();
        root.value?.blur();
      },
    },
  });

  ctx.clear = () => {
    store.dispatchSync(clearAction());
  };

  ctx.destroy = () => {
    appDestroy(app);
    Array.from(destroySet).forEach(destroy => destroy());
    Array.from(sharedStoreSet).forEach(sharedStore => sharedStore.destroy());
    destroySet.clear();
    sharedStoreSet.clear();
  };

  ctx.setInitialValue = value => {
    const safeValue = toSafeString(value);
    store.dispatchSync(
      initialLoadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
    );
    emitter.emit(schemaGCAction());
  };

  ctx.setPresetTheme = newThemeOptions => {
    if (
      isString(newThemeOptions.grayColor) &&
      hasGrayColor(newThemeOptions.grayColor)
    ) {
      themeState.options.grayColor = newThemeOptions.grayColor;
    }
    if (
      isString(newThemeOptions.accentColor) &&
      hasAccentColor(newThemeOptions.accentColor)
    ) {
      themeState.options.accentColor = newThemeOptions.accentColor;
    }
    if (
      isString(newThemeOptions.appearance) &&
      hasAppearance(newThemeOptions.appearance)
    ) {
      themeState.options.appearance = newThemeOptions.appearance;
    }
  };

  ctx.setTheme = newTheme => {
    const customTheme: Partial<Theme> = {};
    ThemeTokens.forEach(key => {
      const value = get(newTheme, key);
      isString(value) && Reflect.set(customTheme, key, value);
    });
    themeState.custom = customTheme;
  };

  ctx.setKeyBindingMap = newKeyBindingMap => {
    ExternalKeyBindingNameList.forEach(key => {
      const value = get(newKeyBindingMap, key);
      isArray(value) && Reflect.set(keyBindingMap, key, value);
    });
  };

  ctx.setSchemaSQL = value => {
    const safeValue = toSafeString(value);
    if (isEmpty(safeValue)) return;

    store.dispatchSync(loadSchemaSQLAction$(safeValue));
  };

  ctx.setSchemaGraphQL = value => {
    const safeValue = toSafeString(value);
    if (isEmpty(safeValue)) return;

    store.dispatchSync(loadSchemaGraphQLAction$(safeValue));
  };

  ctx.setSchemaDBML = value => {
    const safeValue = toSafeString(value);
    if (isEmpty(safeValue)) return;

    store.dispatchSync(loadSchemaDBMLAction$(safeValue));
  };

  ctx.getSchemaSQL = databaseVendor => {
    const isDatabaseVendor = hasDatabaseVendor(databaseVendor ?? '');
    const database = isDatabaseVendor
      ? get(DatabaseVendorToDatabase, databaseVendor ?? '')
      : undefined;
    return createSchemaSQL(store.state, database);
  };

  ctx.getSharedStore = config => {
    const mouseTracker = config?.mouseTracker ?? true;
    const sharedStore = createSharedStore(store, config);
    const facade: SharedStore = Object.freeze({
      ...sharedStore,
      destroy: () => {
        sharedStore.destroy();
        sharedStoreSet.delete(facade);

        if (sharedStoreSet.size === 0) {
          emitter.emit(mouseTrackerEndAction());
        }
      },
    });
    sharedStoreSet.add(facade);

    if (mouseTracker) {
      emitter.emit(mouseTrackerStartAction());
    }

    return facade;
  };

  ctx.setDiffValue = value => {
    const safeValue = toSafeString(value);
    emitter.emit(
      openDiffViewerAction({ value: isEmpty(safeValue) ? '{}' : safeValue })
    );
  };

  Object.defineProperty(ctx, 'value', {
    get: () => toJson(store.state),
    set: (value: string) => {
      const safeValue = toSafeString(value);
      store.dispatchSync(
        loadJsonAction$(isEmpty(safeValue) ? '{}' : safeValue)
      );
    },
  });

  return {
    theme,
    themeState,
    destroySet,
    hasDarkMode: () => themeState.options.appearance === Appearance.dark,
  };
}
