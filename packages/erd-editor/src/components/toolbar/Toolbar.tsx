import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { dictionaryViewOf } from '@/components/dictionary/dictionaryView';
import { isEntrySheet } from '@/components/dictionary/sheets';
import {
  isExplorerPressed,
  toggleExplorer,
} from '@/components/explorer/explorerCommands';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { TOOLBAR_DATABASE_NAME_WIDTH } from '@/constants/layout';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import type { DictionaryKind } from '@/engine/modules/dictionary/actions';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeDatabaseNameAction,
} from '@/engine/modules/settings/atom.actions';
import {
  openLocalePickerAction,
  openThemeBuilderAction,
  toggleSearchAction,
} from '@/utils/emitter';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';
import { isTakenOver } from '@/utils/takeover';

import * as styles from './Toolbar.styles';

export type ToolbarProps = {
  enableThemeBuilder: boolean;
  enableLocalePicker?: boolean;
  readonly: boolean;
};

const Toolbar: FC<ToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  const handleChangeDatabaseName = (event: InputEvent) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const { store } = app.value;
    store.dispatch(changeDatabaseNameAction({ value: el.value }));
  };

  const handleChangeCanvasType = (value: string) => {
    const { store } = app.value;
    store.dispatch(changeCanvasTypeAction({ value }));
  };

  /** The dictionary sheet whose history the buttons run on the Dictionary tab, null elsewhere and on the check sheet. */
  const shownSheet = (): DictionaryKind | null => {
    const { store } = app.value;
    if (store.state.settings.canvasType !== CanvasType.dictionary) return null;

    const { sheet } = dictionaryViewOf(app.value);
    return isEntrySheet(sheet) ? sheet : null;
  };

  const handleUndo = () => {
    const { store } = app.value;
    const sheet = shownSheet();
    if (sheet) store.undoSheet(sheet);
    else store.undo();
  };

  const handleRedo = () => {
    const { store } = app.value;
    const sheet = shownSheet();
    if (sheet) store.redoSheet(sheet);
    else store.redo();
  };

  const handleUnselectAll = () => {
    const { store } = app.value;
    store.dispatch(unselectAllAction$());
  };

  const handleSearch = () => {
    const { emitter } = app.value;
    emitter.emit(toggleSearchAction());
  };

  /**
   * Shown on every tab, as opening brings the ERD tab up, so the bar never
   * shifts. Pressed while the Explorer is open on the ERD tab; on another tab
   * a press only opens it there (an owner decision of 2026-10-13).
   */
  const handleExplorer = () => {
    toggleExplorer(app.value.store);
  };

  /** Spares the selection, and with it the ring on a search's current match, as the chord does. */
  const keepSelection = (event: Event) => event.stopPropagation();

  const handleTheme = () => {
    const { emitter } = app.value;
    emitter.emit(openThemeBuilderAction());
  };

  const handleLocale = () => {
    const { emitter } = app.value;
    emitter.emit(openLocalePickerAction());
  };

  const handleOpenTimeTravel = () => {
    const { store } = app.value;
    const { editor } = store.state;

    if (editor.hasUndo || editor.hasRedo) {
      store.dispatch(changeOpenMapAction({ [Open.timeTravel]: true }));
    }
  };

  return () => {
    const { store, keyBindingMap } = app.value;
    const { settings, editor } = store.state;
    const { t, dir } = i18n.value;
    const title = (name: string, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, name, keyBindingName);
    // A right-to-left reader goes back to the right, so the two arrows swap.
    const mirrored = dir === 'rtl';

    const showAutomaticTablePlacement =
      editor.openMap[Open.automaticTablePlacement];
    const showTableProperties = editor.openMap[Open.tableProperties];
    const showTimeTravel = editor.openMap[Open.timeTravel];
    const showDiffViewer = editor.openMap[Open.diffViewer];

    const showDocumentHistory =
      settings.canvasType === CanvasType.ERD &&
      !showAutomaticTablePlacement &&
      !showTableProperties &&
      !showDiffViewer &&
      !showTimeTravel &&
      !props.readonly;
    // The Dictionary tab's buttons run the sheet shown's own history, none on
    // the check sheet, which no edit reaches.
    const onDictionary =
      settings.canvasType === CanvasType.dictionary && !props.readonly;
    const sheet = onDictionary ? shownSheet() : null;
    const has = sheet
      ? editor.dictionaryHistory[sheet]
      : onDictionary
        ? { hasUndo: false, hasRedo: false }
        : editor;
    const showUndoRedo = showDocumentHistory || onDictionary;

    return (
      <div
        class={['toolbar', styles.root]}
        on:mousedown={handleUnselectAll}
        on:touchstart={handleUnselectAll}
      >
        <input
          title={t('toolbar.databaseName')}
          placeholder={t('toolbar.databaseName')}
          style={{ width: `${TOOLBAR_DATABASE_NAME_WIDTH}px` }}
          type="text"
          spellcheck="false"
          prop:dir="auto"
          prop:value={settings.databaseName ?? ''}
          on:input={handleChangeDatabaseName}
        />
        <div class={styles.vertical}></div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.ERD },
          ]}
          title={t('common.tab.erd')}
          on:click={() => handleChangeCanvasType(CanvasType.ERD)}
        >
          <Icon name="workflow" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.visualization },
          ]}
          title={t('common.tab.visualization')}
          on:click={() => handleChangeCanvasType(CanvasType.visualization)}
        >
          <Icon name="share-2" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.schemaSQL },
          ]}
          title={t('common.tab.schemaSql')}
          on:click={() => handleChangeCanvasType(CanvasType.schemaSQL)}
        >
          <Icon name="database" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.generatorCode },
          ]}
          title={t('common.tab.codeGenerator')}
          on:click={() => handleChangeCanvasType(CanvasType.generatorCode)}
        >
          <Icon name="code" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.dictionary },
          ]}
          title={t('common.tab.dictionary')}
          on:click={() => handleChangeCanvasType(CanvasType.dictionary)}
        >
          <Icon name="book-a" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.settings },
          ]}
          title={t('common.tab.settings')}
          on:click={() => handleChangeCanvasType(CanvasType.settings)}
        >
          <Icon name="settings" size={16} />
        </div>
        <div class={styles.vertical}></div>
        <div
          class={['toolbar-search', styles.menu]}
          title={title(t('common.search'), KeyBindingName.search)}
          on:click={handleSearch}
        >
          <Icon name="search" size={16} />
        </div>
        <div
          class={[
            'toolbar-explorer',
            styles.menu,
            {
              active: isExplorerPressed(store),
              disabled: isTakenOver(store.state),
            },
          ]}
          title={title(t('explorer.title'), KeyBindingName.findReplace)}
          on:mousedown={keepSelection}
          on:touchstart={keepSelection}
          on:click={handleExplorer}
        >
          <Icon name="list-tree" size={16} />
        </div>
        {props.enableThemeBuilder ? (
          <div
            class={['toolbar-theme', styles.menu]}
            title={t('common.theme')}
            on:click={handleTheme}
          >
            <Icon name="contrast" size={16} />
          </div>
        ) : null}
        {props.enableLocalePicker ? (
          <div
            class={['toolbar-locale', styles.menu]}
            title={t('common.displayLanguage')}
            on:click={handleLocale}
          >
            <Icon name="languages" size={16} />
          </div>
        ) : null}
        <div class={styles.vertical}></div>
        {showUndoRedo ? (
          <>
            <div
              class={[
                'undo-redo',
                styles.menu,
                {
                  active: has.hasUndo,
                },
              ]}
              title={title(t('toolbar.undo'), KeyBindingName.undo)}
              on:click={handleUndo}
            >
              {mirrored ? (
                <Icon name="redo-2" size={16} />
              ) : (
                <Icon name="undo-2" size={16} />
              )}
            </div>
            <div
              class={[
                'undo-redo',
                styles.menu,
                {
                  active: has.hasRedo,
                },
              ]}
              title={title(t('toolbar.redo'), KeyBindingName.redo)}
              on:click={handleRedo}
            >
              {mirrored ? (
                <Icon name="undo-2" size={16} />
              ) : (
                <Icon name="redo-2" size={16} />
              )}
            </div>
            {showDocumentHistory ? (
              <div
                class={[
                  'undo-redo',
                  styles.menu,
                  {
                    active: editor.hasUndo || editor.hasRedo,
                  },
                ]}
                title={t('toolbar.timeTravel')}
                style={{
                  'max-width': '26px',
                }}
                on:click={handleOpenTimeTravel}
              >
                <Icon name="rotate-ccw-clock" size={16} />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
  };
};

export default Toolbar;
