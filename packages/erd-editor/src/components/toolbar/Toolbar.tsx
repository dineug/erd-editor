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
  resizeAction,
} from '@/engine/modules/settings/atom.actions';
import { changeZoomLevelAction$ } from '@/engine/modules/settings/generator.actions';
import { openThemeBuilderAction, toggleSearchAction } from '@/utils/emitter';
import {
  canvasSizeInRange,
  toNumString,
  toZoomFormat,
  zoomLevelInRange,
} from '@/utils/validation';

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

  const handleResize = (event: Event) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const size = canvasSizeInRange(el.value);
    const { store } = app.value;
    el.value = size.toString();
    store.dispatch(resizeAction({ width: size, height: size }));
  };

  const handleZoomLevel = (event: Event) => {
    const el = event.target as HTMLInputElement | null;
    if (!el) return;

    const zoomLevel = zoomLevelInRange(Number(toNumString(el.value)) / 100);
    const { store } = app.value;
    el.value = toZoomFormat(zoomLevel);
    store.dispatch(changeZoomLevelAction$(zoomLevel));
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
    const { store } = app.value;
    const { settings, editor, doc } = store.state;

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
        <TextInput
          title="database name"
          placeholder="database name"
          width={150}
          value={settings.databaseName}
          onInput={handleChangeDatabaseName}
        />
        <TextInput
          title="canvas size"
          placeholder="canvas size"
          width={45}
          value={settings.width.toString()}
          numberOnly={true}
          onChange={handleResize}
        />
        <TextInput
          title="zoom level"
          placeholder="zoom level"
          width={45}
          value={toZoomFormat(settings.zoomLevel)}
          numberOnly={true}
          onChange={handleZoomLevel}
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
        <div class={styles.menu} title="Search" on:click={handleSearch}>
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
              title="Undo"
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
              title="Redo"
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
