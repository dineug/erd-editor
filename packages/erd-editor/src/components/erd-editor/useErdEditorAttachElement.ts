import { toJson } from '@dineug/erd-editor-schema';
import {
  observable,
  onBeforeMount,
  onMounted,
  Ref,
  watch,
} from '@dineug/r-html';
import { cloneDeep, isString, omit } from 'es-toolkit';
import { get, isEmpty } from 'es-toolkit/compat';

import { AppContext, appDestroy } from '@/components/appContext';
import { DatabaseVendorToDatabase } from '@/constants/sql/database';
import {
  clearAction,
  getLWWAction,
  initialClearAction,
  SHARED_DRAG_SELECT_TRACKER_TIMEOUT,
  SHARED_FOCUS_TRACKER_TIMEOUT,
  sharedDragSelectTrackerAction,
  sharedFocusTrackerAction,
  sharedSelectionTrackerAction,
} from '@/engine/modules/editor/atom.actions';
import {
  initialLoadJsonAction$,
  loadJsonAction$,
  type SchemaImportType,
} from '@/engine/modules/editor/generator.actions';
import { createSharedStore, SharedStore } from '@/engine/shared-store';
import { useDarkMode } from '@/hooks/useDarkMode';
import { useNavigatorLanguages } from '@/hooks/useNavigatorLanguages';
import { useUnmounted } from '@/hooks/useUnmounted';
import {
  hasLocaleOption,
  LocaleCode,
  LocaleOption,
  SYSTEM_LOCALE,
} from '@/i18n/locales';
import { messagesOf } from '@/i18n/messages/index';
import { resolveLocale } from '@/i18n/resolveLocale';
import { createI18n, I18n } from '@/i18n/translate';
import { Unsubscribe } from '@/internal-types';
import {
  AccentColor,
  AccentColorList,
  Appearance,
  AppearanceList,
  AppearanceOptionList,
  createTheme,
  GrayColor,
  GrayColorList,
  ResolvedThemeOptions,
  SYSTEM_APPEARANCE,
  ThemeOptions,
} from '@/themes/radix-ui-theme';
import { Theme, ThemeTokens } from '@/themes/tokens';
import { arrayHas } from '@/utils/arrayHas';
import {
  mouseTrackerEndAction,
  mouseTrackerStartAction,
  openDiffViewerAction,
  schemaGCAction,
} from '@/utils/emitter';
import {
  appendSchema,
  appendSchemaJSON,
  appendSchemaPlaced,
  importSchema,
  importSchemaPlaced,
} from '@/utils/file/importSchema';
import { toSharedFocus, toSharedFocusKey } from '@/utils/focus';
import { KeyBindingName, KeyBindingNameList } from '@/utils/keyboard-shortcut';
import { toLoadValue } from '@/utils/loadValue';
import {
  createSchemaSQL,
  isSchemaSQLHeader,
  isSchemaSQLStatements,
  SchemaSQLOptions,
} from '@/utils/schema-sql';
import { hasDatabaseVendor, toSafeString } from '@/utils/validation';

import {
  ErdEditorElement,
  ErdEditorProps,
  SchemaImportOptions,
  SetSchema,
} from './ErdEditor';

/**
 * The editor's own chords, which a host cannot remap. Search is not among them:
 * it only opens a panel, and a host is the one that knows which chord is free.
 */
const hasOmitKeyBindingName = arrayHas<string>([
  KeyBindingName.edit,
  KeyBindingName.stop,
  KeyBindingName.undo,
  KeyBindingName.redo,
  KeyBindingName.zoomIn,
  KeyBindingName.zoomOut,
  KeyBindingName.zoomReset,
]);

const ExternalKeyBindingNameList = KeyBindingNameList.filter(
  key => !hasOmitKeyBindingName(key)
);

const defaultThemeOptions: ResolvedThemeOptions = {
  grayColor: GrayColor.slate,
  accentColor: AccentColor.indigo,
  appearance: Appearance.dark,
} as const;

const hasGrayColor = arrayHas<string>(GrayColorList);
const hasAccentColor = arrayHas<string>(AccentColorList);
const hasAppearance = arrayHas<string>(AppearanceList);
const hasAppearanceOption = arrayHas<string>(AppearanceOptionList);

/** What getSchemaSQL takes of a host's options: a known statements and header, no other key. */
function toSchemaSQLOptions(options: unknown): SchemaSQLOptions {
  if (typeof options !== 'object' || options === null) return {};
  const { statements, header } = options as Record<string, unknown>;

  return {
    ...(isSchemaSQLStatements(statements) ? { statements } : {}),
    ...(isSchemaSQLHeader(header) ? { header } : {}),
  };
}

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
    /** What system shows once a host names it; null follows the OS color scheme. */
    systemAppearance: Appearance | null;
    preset: Theme;
    custom: Partial<Theme>;
  }>({
    options: { ...defaultThemeOptions },
    systemAppearance: null,
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
  const navigatorLanguages = useNavigatorLanguages();
  const { addUnsubscribe } = useUnmounted();

  const localeState = observable<{
    /** The option a host or a pick last set; null until either sets one. */
    option: LocaleOption | null;
    /** What system means once a host names its own language; null reads the browser's. */
    systemTag: string | null;
  }>({
    option: null,
    systemTag: null,
  });

  /**
   * The option in force. With none set it is system while the element offers
   * its picker and English while it does not, so an element no host configures
   * keeps the English it always showed (an owner decision of 2026-10-06).
   */
  const resolveLocaleOption = (): LocaleOption =>
    localeState.option ?? (props.enableLocalePicker ? SYSTEM_LOCALE : 'en');

  const resolveSystemLocale = (): LocaleCode =>
    resolveLocale(localeState.systemTag ?? navigatorLanguages.state.languages);

  const resolveCurrentLocale = (): LocaleCode => {
    const option = resolveLocaleOption();
    return option === SYSTEM_LOCALE ? resolveSystemLocale() : option;
  };

  // Resolved here and again just before each mount, so a language a host sets
  // or a picker it turns on before appending the element is in its first render.
  const initialLocale = resolveCurrentLocale();
  const i18n = observable<I18n>(
    { ...createI18n(initialLocale, messagesOf(initialLocale)) },
    { shallow: true }
  );

  /**
   * Assigns the language into the object every component already reads, never
   * a new one through the provider, which a component mounted later would miss.
   */
  const applyLocale = () => {
    const code = resolveCurrentLocale();
    if (code === i18n.locale) return;

    Object.assign(i18n, createI18n(code, messagesOf(code)));
  };

  onBeforeMount(applyLocale);

  const resolveAppearance = (): Appearance => {
    const { options, systemAppearance } = themeState;
    if (options.appearance !== SYSTEM_APPEARANCE) return options.appearance;
    if (systemAppearance) return systemAppearance;
    return darkMode.state.isDark ? Appearance.dark : Appearance.light;
  };

  const applyPreset = () => {
    Object.assign(
      themeState.preset,
      createTheme({ ...themeState.options, appearance: resolveAppearance() })
    );
  };

  const followsSystem = () =>
    themeState.options.appearance === SYSTEM_APPEARANCE;
  const sharedStoreSet = new Set<SharedStore>();
  let presenceTrackerUnsubscribe: Unsubscribe | null = null;
  let presenceTrackerIntervalId: any = -1;
  let dragSelectTrackerIntervalId: any = -1;
  let sharedFocusKey = '';
  let sharedSelectionKey = '';
  let sharedDragSelectKey = '';

  const broadcastSharedFocus = (force: boolean) => {
    const focus = toSharedFocus(store.state.editor.focusTable);
    const key = toSharedFocusKey(focus);
    if (key === sharedFocusKey && !force) return;

    sharedFocusKey = key;
    store.dispatch(sharedFocusTrackerAction({ focus }));
  };

  const broadcastSharedSelection = (force: boolean) => {
    const selectedIds = Object.keys(store.state.editor.selectedMap).sort();
    const key = selectedIds.length ? JSON.stringify(selectedIds) : '';
    if (key === sharedSelectionKey && !force) return;

    sharedSelectionKey = key;
    store.dispatch(sharedSelectionTrackerAction({ selectedIds }));
  };

  const broadcastSharedDragSelect = (force: boolean) => {
    const rect = store.state.editor.dragSelect;
    const key = rect ? JSON.stringify([rect.x, rect.y, rect.w, rect.h]) : '';
    if (key === sharedDragSelectKey && !force) return;

    sharedDragSelectKey = key;
    store.dispatch(
      sharedDragSelectTrackerAction({ rect: rect ? { ...rect } : null })
    );
  };

  const presenceTrackerEnd = () => {
    presenceTrackerUnsubscribe?.();
    presenceTrackerUnsubscribe = null;
    clearInterval(presenceTrackerIntervalId);
    presenceTrackerIntervalId = -1;
    clearInterval(dragSelectTrackerIntervalId);
    dragSelectTrackerIntervalId = -1;
  };

  const presenceTrackerStart = () => {
    presenceTrackerEnd();
    sharedFocusKey = '';
    sharedSelectionKey = '';
    sharedDragSelectKey = '';
    presenceTrackerUnsubscribe = store.subscribe(actions => {
      const force = actions.some(action => action.type === getLWWAction.type);
      broadcastSharedFocus(force);
      broadcastSharedSelection(force);
      broadcastSharedDragSelect(force);
    });
    presenceTrackerIntervalId = setInterval(() => {
      sharedFocusKey && broadcastSharedFocus(true);
      sharedSelectionKey && broadcastSharedSelection(true);
    }, SHARED_FOCUS_TRACKER_TIMEOUT / 3);
    dragSelectTrackerIntervalId = setInterval(() => {
      sharedDragSelectKey && broadcastSharedDragSelect(true);
    }, SHARED_DRAG_SELECT_TRACKER_TIMEOUT / 3);
    broadcastSharedFocus(false);
    broadcastSharedSelection(false);
    broadcastSharedDragSelect(false);
  };

  const emitChange = () => {
    getReadonly() || ctx.dispatchEvent(new CustomEvent('change'));
  };

  const destroySet = new Set<Unsubscribe>([
    watch(props).subscribe(propName => {
      if (propName === 'enableLocalePicker') {
        applyLocale();
        return;
      }
      if (propName !== 'systemDarkMode') return;

      // On, it picks system; off, it keeps the appearance system shows now.
      if (props.systemDarkMode) {
        themeState.options.appearance = SYSTEM_APPEARANCE;
      } else if (followsSystem()) {
        themeState.options.appearance = resolveAppearance();
      }
    }),
    watch(darkMode.state).subscribe(propName => {
      if (propName !== 'isDark' || !followsSystem()) return;
      if (themeState.systemAppearance) return;

      applyPreset();
    }),
    watch(themeState.options).subscribe(applyPreset),
    watch(themeState.preset).subscribe(() => {
      Object.assign(theme, themeState.preset, themeState.custom);
    }),
    watch(themeState).subscribe(propName => {
      if (propName === 'systemAppearance') {
        followsSystem() && applyPreset();
        return;
      }
      if (propName !== 'custom') return;

      Object.assign(theme, themeState.preset, themeState.custom);
    }),
    watch(localeState).subscribe(applyLocale),
    watch(navigatorLanguages.state).subscribe(applyLocale),
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
        setLocaleOption: ({ payload }) => {
          ctx.setLocale(payload.locale);
          if (localeState.option !== payload.locale) return;

          ctx.dispatchEvent(
            new CustomEvent('changeLocale', {
              detail: { locale: payload.locale },
            })
          );
        },
      })
    );
  });

  // focus and blur shadow the prototype methods. An environment that patches
  // those can leave them getter-only accessors, where a plain assignment throws
  // in strict mode; defining own properties skips the setter lookup.
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
    store.dispatchSync(initialLoadJsonAction$(toLoadValue(value)));
    store.resetHistory();
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
      hasAppearanceOption(newThemeOptions.appearance)
    ) {
      themeState.options.appearance = newThemeOptions.appearance;
    }
  };

  ctx.setSystemAppearance = appearance => {
    themeState.systemAppearance =
      isString(appearance) && hasAppearance(appearance) ? appearance : null;
  };

  // Both apply before they return, so a host that names the language before it
  // appends the element paints it in that language from the first frame.
  ctx.setLocale = locale => {
    if (!isString(locale) || !hasLocaleOption(locale)) return;

    localeState.option = locale;
    applyLocale();
  };

  ctx.setSystemLocale = locale => {
    const tag = isString(locale) ? locale.trim() : '';
    localeState.systemTag = tag || null;
    applyLocale();
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
      Array.isArray(value) && Reflect.set(keyBindingMap, key, value);
    });
  };

  // A Promise only where the import places first, so a setter called as it
  // always was still lands before it returns. A readonly editor refuses the
  // load, and the placed imports check that before they lay anything out.
  const setSchema = (type: SchemaImportType) =>
    ((value: string, options?: SchemaImportOptions) => {
      const safeValue = toSafeString(value);
      const append = options?.mode === 'append';

      if (options?.placement !== 'auto') {
        if (isEmpty(safeValue)) return;

        if (!append) {
          importSchema(app, type, safeValue);
        } else if (!getReadonly()) {
          appendSchema(app, type, safeValue);
        }
        return;
      }

      if (isEmpty(safeValue)) return Promise.resolve();

      return append
        ? appendSchemaPlaced(app, type, safeValue)
        : importSchemaPlaced(app, type, safeValue);
    }) as SetSchema;

  ctx.setSchemaSQL = setSchema('sql');
  ctx.setSchemaGraphQL = setSchema('graphql');
  ctx.setSchemaDBML = setSchema('dbml');
  ctx.setSchemaAML = setSchema('aml');

  ctx.setSchemaJSON = (value, options) => {
    const safeValue = toSafeString(value);
    if (isEmpty(safeValue)) return;

    if (options?.mode !== 'append') {
      store.dispatchSync(loadJsonAction$(safeValue));
    } else if (!getReadonly()) {
      appendSchemaJSON(app, safeValue);
    }
  };

  ctx.getSchemaSQL = (databaseVendor, options) => {
    const isDatabaseVendor = hasDatabaseVendor(databaseVendor ?? '');
    const database = isDatabaseVendor
      ? get(DatabaseVendorToDatabase, databaseVendor ?? '')
      : undefined;
    return createSchemaSQL(
      store.state,
      database,
      undefined,
      toSchemaSQLOptions(options)
    );
  };

  ctx.getSharedStore = config => {
    const mouseTracker = config?.mouseTracker ?? true;
    const focusTracker = config?.focusTracker ?? true;
    const sharedStore = createSharedStore(store, config);
    const facade: SharedStore = Object.freeze({
      ...sharedStore,
      destroy: () => {
        sharedStore.destroy();
        sharedStoreSet.delete(facade);

        if (sharedStoreSet.size === 0) {
          emitter.emit(mouseTrackerEndAction());
          presenceTrackerEnd();
        }
      },
    });
    sharedStoreSet.add(facade);

    if (mouseTracker) {
      emitter.emit(mouseTrackerStartAction());
    }

    if (focusTracker) {
      presenceTrackerStart();
    }

    return facade;
  };

  ctx.setDiffValue = value => {
    emitter.emit(openDiffViewerAction({ value: toLoadValue(value) }));
  };

  Object.defineProperty(ctx, 'value', {
    get: () => toJson(store.state),
    set: (value: string) => {
      store.dispatchSync(loadJsonAction$(toLoadValue(value)));
    },
  });

  return {
    theme,
    themeState,
    i18n,
    localeState,
    resolveLocaleOption,
    resolveSystemLocale,
    destroySet,
    hasDarkMode: () => resolveAppearance() === Appearance.dark,
  };
}
