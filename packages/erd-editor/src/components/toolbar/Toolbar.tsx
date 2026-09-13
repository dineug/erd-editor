import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Icon from '@/components/primitives/icon/Icon';
import TextInput from '@/components/primitives/text-input/TextInput';
import { Open } from '@/constants/open';
import { CanvasType } from '@/constants/schema';
import { changeOpenMapAction } from '@/engine/modules/editor/atom.actions';
import { unselectAllAction$ } from '@/engine/modules/editor/generator.actions';
import {
  changeCanvasTypeAction,
  changeDatabaseNameAction,
} from '@/engine/modules/settings/atom.actions';
import { openThemeBuilderAction, toggleSearchAction } from '@/utils/emitter';
import { KeyBindingName, toShortcutTitle } from '@/utils/keyboard-shortcut';

import * as styles from './Toolbar.styles';

export type ToolbarProps = {
  enableThemeBuilder: boolean;
  readonly: boolean;
};

const Toolbar: FC<ToolbarProps> = (props, ctx) => {
  const app = useAppContext(ctx);

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

  const handleTheme = () => {
    const { emitter } = app.value;
    emitter.emit(openThemeBuilderAction());
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
    const title = (name: string, keyBindingName: KeyBindingName) =>
      toShortcutTitle(keyBindingMap, name, keyBindingName);

    const showAutomaticTablePlacement =
      editor.openMap[Open.automaticTablePlacement];
    const showTableProperties = editor.openMap[Open.tableProperties];
    const showTimeTravel = editor.openMap[Open.timeTravel];
    const showDiffViewer = editor.openMap[Open.diffViewer];

    // The history group leaves on an open panel, and stands on the ERD tab
    // alone: the zoom it sits beside went to the floating toolbar over the
    // canvas, where the tools that drive that canvas are.
    const isErd = settings.canvasType === CanvasType.ERD;

    const showUndoRedo =
      isErd &&
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
        <TextInput
          title="database name"
          placeholder="database name"
          width={150}
          value={settings.databaseName}
          onInput={handleChangeDatabaseName}
        />
        <div class={styles.vertical}></div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.ERD },
          ]}
          title="Entity Relationship Diagram"
          on:click={() => handleChangeCanvasType(CanvasType.ERD)}
        >
          <Icon name="workflow" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.visualization },
          ]}
          title="Visualization"
          on:click={() => handleChangeCanvasType(CanvasType.visualization)}
        >
          <Icon name="share-2" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.schemaSQL },
          ]}
          title="Schema SQL"
          on:click={() => handleChangeCanvasType(CanvasType.schemaSQL)}
        >
          <Icon name="database" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.generatorCode },
          ]}
          title="Code Generator"
          on:click={() => handleChangeCanvasType(CanvasType.generatorCode)}
        >
          <Icon name="code" size={16} />
        </div>
        <div
          class={[
            styles.menu,
            { active: settings.canvasType === CanvasType.settings },
          ]}
          title="Settings"
          on:click={() => handleChangeCanvasType(CanvasType.settings)}
        >
          <Icon name="settings" size={16} />
        </div>
        <div class={styles.vertical}></div>
        <div
          class={styles.menu}
          title={title('Search', KeyBindingName.search)}
          on:click={handleSearch}
        >
          <Icon name="search" size={16} />
        </div>
        {props.enableThemeBuilder ? (
          <div class={styles.menu} title="Theme" on:click={handleTheme}>
            <Icon name="contrast" size={16} />
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
              title={title('Undo', KeyBindingName.undo)}
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
              title={title('Redo', KeyBindingName.redo)}
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
              title="Time Travel"
              style={{
                'max-width': '26px',
              }}
              on:click={handleOpenTimeTravel}
            >
              <Icon name="rotate-ccw-clock" size={16} />
            </div>
          </>
        ) : null}
        <div class={styles.tableCount}>Table: {doc.tableIds.length}</div>
      </div>
    );
  };
};

export default Toolbar;
