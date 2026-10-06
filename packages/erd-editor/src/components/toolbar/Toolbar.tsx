import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { isTakenOver } from '@/components/find-replace/panelLayout';
import { useI18n } from '@/components/localeContext';
import Icon from '@/components/primitives/icon/Icon';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeDatabaseNameAction,
} from '@/engine/modules/settings/atom.actions';
import {
  openFindReplaceAction,
  openLocalePickerAction,
  openThemeBuilderAction,
  toggleSearchAction,
} from '@/utils/emitter';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

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

  const handleUndo = () => {
    const { store } = app.value;
    store.undo();
  };

  const handleRedo = () => {
    const { store } = app.value;
    store.redo();
  };

  const handleUnselectAll = () => {
    const { store } = app.value;
    store.dispatch(unselectAllAction$());
  };

  const handleSearch = () => {
    const { emitter } = app.value;
    emitter.emit(toggleSearchAction());
  };

  /** Shown on every tab, as opening brings the ERD tab up, so the bar never shifts. */
  const handleFindReplace = () => {
    const { emitter } = app.value;
    emitter.emit(openFindReplaceAction());
  };

  /** Spares the selection, and with it the ring on the panel's current match, as the chord does. */
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
    const { settings, editor, doc } = store.state;
    const { t } = i18n.value;
    const title = (name: string, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, name, keyBindingName);

    const showAutomaticTablePlacement =
      editor.openMap[Open.automaticTablePlacement];
    const showTableProperties = editor.openMap[Open.tableProperties];
    const showTimeTravel = editor.openMap[Open.timeTravel];
    const showDiffViewer = editor.openMap[Open.diffViewer];

    const showUndoRedo =
      settings.canvasType === CanvasType.ERD &&
      !showAutomaticTablePlacement &&
      !showTableProperties &&
      !showDiffViewer &&
      !showTimeTravel &&
      !props.readonly;

    return (
      <div
        class={['toolbar', styles.root]}
        on:mousedown={handleUnselectAll}
        on:touchstart={handleUnselectAll}
      >
        <input
          title={t('toolbar.databaseName')}
          placeholder={t('toolbar.databaseName')}
          style={{ width: '150px' }}
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
          class={[styles.menu, { disabled: isTakenOver(store.state) }]}
          title={title(
            props.readonly ? t('common.find') : t('common.findAndReplace'),
            KeyBindingName.findReplace
          )}
          on:mousedown={keepSelection}
          on:touchstart={keepSelection}
          on:click={handleFindReplace}
        >
          <Icon name="text-search" size={16} />
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
                  active: editor.hasUndo,
                },
              ]}
              title={title(t('toolbar.undo'), KeyBindingName.undo)}
              on:click={handleUndo}
            >
              <Icon name="undo-2" size={16} />
            </div>
            <div
              class={[
                'undo-redo',
                styles.menu,
                {
                  active: editor.hasRedo,
                },
              ]}
              title={title(t('toolbar.redo'), KeyBindingName.redo)}
              on:click={handleRedo}
            >
              <Icon name="redo-2" size={16} />
            </div>
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
          </>
        ) : null}
        <div class={styles.tableCount}>
          {t('toolbar.tableCount', { count: doc.tableIds.length })}
        </div>
      </div>
    );
  };
};

export default Toolbar;
