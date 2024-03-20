import { FC, html } from '@dineug/r-html';

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

    return html`
      <div
        class=${['toolbar', styles.root]}
        @mousedown=${handleUnselectAll}
        @touchstart=${handleUnselectAll}
      >
        <${TextInput}
          title="database name"
          placeholder="database name"
          width=${150}
          value=${settings.databaseName}
          .onInput=${handleChangeDatabaseName}
        />
        <${TextInput}
          title="canvas size"
          placeholder="canvas size"
          width=${45}
          value=${settings.width.toString()}
          numberOnly=${true}
          .onChange=${handleResize}
        />
        <${TextInput}
          title="zoom level"
          placeholder="zoom level"
          width=${45}
          value=${toZoomFormat(settings.zoomLevel)}
          numberOnly=${true}
          .onChange=${handleZoomLevel}
        />
        <div class=${styles.vertical}></div>
        <div
          class=${[
            styles.menu,
            { active: settings.canvasType === CanvasType.ERD },
          ]}
          title="Entity Relationship Diagram"
          @click=${() => handleChangeCanvasType(CanvasType.ERD)}
        >
          <${Icon} name="diagram-project" size=${16} />
        </div>
        <div
          class=${[
            styles.menu,
            { active: settings.canvasType === CanvasType.visualization },
          ]}
          title="Visualization"
          @click=${() => handleChangeCanvasType(CanvasType.visualization)}
        >
          <${Icon} prefix="mdi" name="chart-scatter-plot" size=${16} />
        </div>
        <div
          class=${[
            styles.menu,
            { active: settings.canvasType === CanvasType.schemaSQL },
          ]}
          title="Schema SQL"
          @click=${() => handleChangeCanvasType(CanvasType.schemaSQL)}
        >
          <${Icon} prefix="mdi" name="database-export" size=${16} />
        </div>
        <div
          class=${[
            styles.menu,
            { active: settings.canvasType === CanvasType.generatorCode },
          ]}
          title="Generator Code"
          @click=${() => handleChangeCanvasType(CanvasType.generatorCode)}
        >
          <${Icon} name="file-code" size=${16} />
        </div>
        <div
          class=${[
            styles.menu,
            { active: settings.canvasType === CanvasType.settings },
          ]}
          title="Settings"
          @click=${() => handleChangeCanvasType(CanvasType.settings)}
        >
          <${Icon} name="gear" size=${16} />
        </div>
        <div class=${styles.vertical}></div>
        <div class=${styles.menu} title="Search" @click=${handleSearch}>
          <${Icon} name="magnifying-glass" size=${16} />
        </div>
        ${props.enableThemeBuilder
          ? html`
              <div class=${styles.menu} title="Theme" @click=${handleTheme}>
                <${Icon} name="circle-half-stroke" size=${16} />
              </div>
            `
          : null}
        <div class=${styles.vertical}></div>
        ${showUndoRedo
          ? html`
              <div
                class=${[
                  'undo-redo',
                  styles.menu,
                  {
                    active: editor.hasUndo,
                  },
                ]}
                title="Undo"
                @click=${handleUndo}
              >
                <${Icon} name="rotate-left" size=${16} />
              </div>
              <div
                class=${[
                  'undo-redo',
                  styles.menu,
                  {
                    active: editor.hasRedo,
                  },
                ]}
                title="Redo"
                @click=${handleRedo}
              >
                <${Icon} name="rotate-right" size=${16} />
              </div>
              <div
                class=${[
                  'undo-redo',
                  styles.menu,
                  {
                    active: editor.hasUndo || editor.hasRedo,
                  },
                ]}
                title="Time Travel"
                style=${{
                  'max-width': '26px',
                }}
                @click=${handleOpenTimeTravel}
              >
                <${Icon} prefix="mdi" name="av-timer" size=${20} />
              </div>
            `
          : null}
        <div class=${styles.tableCount}>Table: ${doc.tableIds.length}</div>
      </div>
    `;
  };
};

export default Toolbar;
