import { onMounted, Ref, watch } from '@dineug/r-html';
import { cloneDeep, omit } from 'es-toolkit';
import { get, isEmpty } from 'es-toolkit/compat';

import { AppContext, appDestroy } from '@/components/appContext';
import { useLocaleHost } from '@/components/element-host/localeHost';
import { useThemeHost } from '@/components/element-host/themeHost';
import { DatabaseVendorToDatabase } from '@/constants/sql/database';
import { EDIT_OPEN_KEYS } from '@/engine/actions';
import { documentJsonOf, runtimeJsonOf } from '@/engine/documentJson';
import {
  changeHandToolAction,
  changeOpenMapAction,
  clearAction,
  dragendColumnAction,
  drawEndRelationshipAction,
  editMemoEndAction,
  editTableEndAction,
  editTableGroupEndAction,
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
  unselectAllAction$,
} from '@/engine/modules/editor/generator.actions';
import { restoreScreenSettingsAction$ } from '@/engine/modules/settings/generator.actions';
import { createSharedStore, SharedStore } from '@/engine/shared-store';
import { useNavigatorLanguages } from '@/hooks/useNavigatorLanguages';
import { useUnmounted } from '@/hooks/useUnmounted';
import { LocaleOption, SYSTEM_LOCALE } from '@/i18n/locales';
import { messagesOf } from '@/i18n/messages/index';
import { Unsubscribe } from '@/internal-types';
import { SYSTEM_APPEARANCE } from '@/themes/radix-ui-theme';
import { arrayHas } from '@/utils/arrayHas';
import {
  cancelElkPlacementAction,
  closeColorPickerAction,
  dragendColumnAllAction,
  duplicateDragCancelAction,
  mouseTrackerEndAction,
  mouseTrackerStartAction,
  openDiffViewerAction,
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
import { createSchemaSQL } from '@/utils/schema-sql';
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

/** The dialogs that write the document, each closed, which the readonly filter lets through. */
const CLOSED_EDIT_DIALOGS = Object.fromEntries(
  EDIT_OPEN_KEYS.map(key => [key, false])
);

type Props = {
  props: ErdEditorProps;
  ctx: ErdEditorElement;
  app: AppContext;
  root: Ref<HTMLDivElement>;
};

export function useErdEditorAttachElement({ props, ctx, app, root }: Props) {
  const { store, keyBindingMap, emitter, shortcut$, keydown$ } = app;
  const getReadonly = () => props.readonly;
  const themeHost = useThemeHost();
  const { themeState, resolveAppearance, followsSystem } = themeHost;
  const navigatorLanguages = useNavigatorLanguages();
  const { addUnsubscribe } = useUnmounted();

  const localeHost = useLocaleHost({
    messagesOf,
    languages: navigatorLanguages,
    /**
     * With no option set it is system while the element offers its picker and
     * English while it does not, so an element no host configures keeps the
     * English it always showed (an owner decision of 2026-10-06).
     */
    fallbackOption: (): LocaleOption =>
      props.enableLocalePicker ? SYSTEM_LOCALE : 'en',
  });
  const { localeState, applyLocale } = localeHost;

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

  /**
   * Ends what a reader may not hold: an open editor, a draw, a column drag, an
   * Alt drag's copies, an ELK run, the selection, the hand tool and the dialogs
   * that write. Table Properties, the diff viewer and the image export stay open.
   */
  const closeEditState = () => {
    store.dispatchSync(
      editTableEndAction(),
      editMemoEndAction(),
      editTableGroupEndAction(),
      drawEndRelationshipAction(),
      dragendColumnAction(),
      unselectAllAction$(),
      changeHandToolAction({ value: false }),
      changeOpenMapAction(CLOSED_EDIT_DIALOGS)
    );
    // The picker, a column drag's pointer, the Alt drag's copies and an ELK run
    // are the ERD tab's own, which no action reaches, and the tab hears them
    // behind another tab too; a copy's drop would unselect.
    emitter.emit(closeColorPickerAction());
    emitter.emit(dragendColumnAllAction());
    emitter.emit(duplicateDragCancelAction());
    emitter.emit(cancelElkPlacementAction());
  };

  // One batch, so no peer's setter lands between a setting given back and the
  // end of its baseline; the viewport, the tab and the name view keep the screen.
  const restoreScreen = () => {
    store.dispatchSync(restoreScreenSettingsAction$());
  };

  /**
   * Sends a pan or a drag the shared stores still hold from before the turn,
   * which would otherwise reach a replica behind the absolute placement that
   * leads the first pan once writable, and land it off the screen by its steps.
   */
  const sendHeldStreams = () => {
    sharedStoreSet.forEach(sharedStore => sharedStore.flushStreamBuffers());
  };

  const destroySet = new Set<Unsubscribe>([
    watch(props).subscribe(propName => {
      if (propName === 'readonly') {
        if (props.readonly) {
          sendHeldStreams();
          closeEditState();
        } else {
          restoreScreen();
        }
        return;
      }
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
    themeHost.destroy,
    localeHost.destroy,
  ]);

  let firstMount = true;

  onMounted(() => {
    // Readonly from the start may come from no write the watch hears, so the
    // first mount closes too. A host that moves the element in the page mounts
    // it again, over a selection a jump left, which stays.
    if (firstMount && props.readonly) closeEditState();
    firstMount = false;

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
  };

  ctx.setPresetTheme = themeHost.setPresetTheme;
  ctx.setSystemAppearance = themeHost.setSystemAppearance;
  ctx.setLocale = localeHost.setLocale;
  ctx.setSystemLocale = localeHost.setSystemLocale;
  ctx.setTheme = themeHost.setTheme;

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
    // A host passes statements, header and logical name comments alone, an
    // unknown value read as left out.
    return createSchemaSQL(store.state, database, undefined, {
      statements: options?.statements,
      header: options?.header,
      logicalNameAsComment: options?.logicalNameAsComment,
    });
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
    get: () => documentJsonOf(store),
    set: (value: string) => {
      store.dispatchSync(loadJsonAction$(toLoadValue(value)));
    },
  });

  Object.defineProperty(ctx, 'runtimeValue', {
    get: () => runtimeJsonOf(store),
  });

  return {
    theme: themeHost.theme,
    themeState,
    i18n: localeHost.i18n,
    localeState,
    resolveLocaleOption: localeHost.resolveLocaleOption,
    resolveSystemLocale: localeHost.resolveSystemLocale,
    destroySet,
    hasDarkMode: themeHost.hasDarkMode,
  };
}
