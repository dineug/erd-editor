import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  watch,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';

import { onNumberOnly } from '@/core/helper/dom.helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { useContext } from '@/core/hooks/context.hook';
import { useMenubarPanels } from '@/core/hooks/menubarPanels.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { contextPanelConfig } from '@/core/panel';
import {
  changeDatabaseName,
  resizeCanvas,
  zoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import {
  filterActive$,
  filterActiveEnd$,
  findActive$,
  findActiveEnd,
} from '@/engine/command/editor.cmd.helper';
import {
  canvasSizeRange,
  zoomDisplayFormat,
  zoomLevelRange,
} from '@/engine/store/helper/canvas.helper';

import { MenubarStyle } from './Menubar.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-menubar': MenubarElement;
  }
}

export interface MenubarProps {
  focusState: boolean;
}

export interface MenubarElement extends MenubarProps, HTMLElement {}

const Menubar: FunctionalComponent<MenubarProps, MenubarElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const { panelMenusTpl } = useMenubarPanels(ctx);
  const { resetTooltip } = useTooltip(
    ['.vuerd-menubar-input', '.vuerd-menubar-menu', '.vuerd-editor-status'],
    ctx
  );
  const { unmountedGroup } = useUnmounted();

  const onChangeDatabaseName = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const { store } = contextRef.value;
    store.dispatch(changeDatabaseName(input.value));
  };

  const onResizeCanvas = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const size = canvasSizeRange(input.value);
    const { store } = contextRef.value;
    input.value = size.toString();
    store.dispatch(resizeCanvas(size, size));
  };

  const onZoomLevel = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const zoomLevel = zoomLevelRange(
      Number(input.value.replace(/[^0-9]/g, '')) / 100
    );
    const { store } = contextRef.value;
    input.value = zoomDisplayFormat(zoomLevel);
    store.dispatch(zoomCanvas(zoomLevel));
  };

  const onFind = () => {
    const { store, eventBus } = contextRef.value;
    const { findActive } = store.editorState;

    if (findActive) {
      store.dispatch(findActiveEnd());
    } else {
      store.dispatch(findActive$());
    }

    eventBus.emit(Bus.Drawer.close);
  };

  const onUndo = () => {
    const { store } = contextRef.value;
    store.undo();
  };

  const onRedo = () => {
    const { store } = contextRef.value;
    store.redo();
  };

  const onFilter = () => {
    const { store, eventBus } = contextRef.value;
    const { filterState } = store.editorState;

    if (filterState.active) {
      store.dispatch(filterActiveEnd$());
    } else {
      store.dispatch(filterActive$());
    }

    eventBus.emit(Bus.Drawer.close);
  };

  const onOpenHelp = () => ctx.dispatchEvent(new CustomEvent('open-help'));
  const onOpenSetting = () =>
    ctx.dispatchEvent(new CustomEvent('open-setting'));
  const onOpenTree = () => ctx.dispatchEvent(new CustomEvent('open-tree'));

  beforeMount(() => {
    const { editorState, canvasState } = contextRef.value.store;

    unmountedGroup.push(
      watch(editorState.panels, () => resetTooltip()),
      watch(editorState.excludePanel, () => resetTooltip()),
      watch(contextPanelConfig.panels, () => resetTooltip()),
      watch(contextPanelConfig.exclude, () => resetTooltip()),
      watch(canvasState, propName => {
        if (propName !== 'canvasType') return;

        resetTooltip();
      })
    );
  });

  return () => {
    const { store, keymap } = contextRef.value;
    const {
      canvasState: { databaseName, width, zoomLevel, canvasType },
      editorState: { hasUndo, hasRedo, readonly, filterState },
    } = store;

    return html`
      <div class="vuerd-menubar">
        <div
          class=${classMap({
            'vuerd-editor-status': true,
            focus: props.focusState && readonly,
            edit: props.focusState && !readonly,
          })}
          data-tippy-content="Editor Status"
        ></div>
        <input
          class="vuerd-menubar-input"
          style="width: 150px;"
          type="text"
          data-tippy-content="database name"
          placeholder="database name"
          spellcheck="false"
          ?disabled=${readonly}
          .value=${databaseName}
          @input=${onChangeDatabaseName}
        />
        <input
          class="vuerd-menubar-input"
          style="width: 45px;"
          type="text"
          data-tippy-content="canvas size"
          spellcheck="false"
          placeholder="canvas size"
          ?disabled=${readonly}
          .value=${width.toString()}
          @input=${onNumberOnly}
          @change=${onResizeCanvas}
        />
        <input
          class="vuerd-menubar-input"
          style="width: 45px;"
          type="text"
          data-tippy-content="zoom level"
          spellcheck="false"
          placeholder="zoom level"
          .value=${zoomDisplayFormat(zoomLevel)}
          @input=${onNumberOnly}
          @change=${onZoomLevel}
        />
        ${panelMenusTpl()}
        <div class="vuerd-menubar-menu-vertical"></div>
        <div
          class="vuerd-menubar-menu"
          data-tippy-content="Table Tree"
          @click=${onOpenTree}
        >
          <vuerd-icon name="tree" size="16"></vuerd-icon>
        </div>
        <div
          class="vuerd-menubar-menu"
          data-tippy-content="Help"
          @click=${onOpenHelp}
        >
          <vuerd-icon name="question" size="16"></vuerd-icon>
        </div>
        <div
          class="vuerd-menubar-menu"
          data-tippy-content="Setting"
          @click=${onOpenSetting}
        >
          <vuerd-icon name="cog" size="16"></vuerd-icon>
        </div>
        <div class="vuerd-menubar-menu-vertical"></div>
        ${canvasType === 'ERD'
          ? html`
              <div
                class="vuerd-menubar-menu"
                data-tippy-content="Find [${keymapOptionsToString(
                  keymap.find
                )}]"
                @click=${onFind}
              >
                <vuerd-icon name="search" size="16"></vuerd-icon>
              </div>
              <div
                class=${classMap({
                  'vuerd-menubar-menu': true,
                  'undo-redo': true,
                  active: hasUndo && !readonly,
                })}
                data-tippy-content=${`Undo [${keymapOptionsToString(
                  keymap.undo
                )}]`}
                @click=${onUndo}
              >
                <vuerd-icon name="undo-alt" size="16"></vuerd-icon>
              </div>
              <div
                class=${classMap({
                  'vuerd-menubar-menu': true,
                  'undo-redo': true,
                  active: hasRedo && !readonly,
                })}
                data-tippy-content=${`Redo [${keymapOptionsToString(
                  keymap.redo
                )}]`}
                @click=${onRedo}
              >
                <vuerd-icon name="redo-alt" size="16"></vuerd-icon>
              </div>
            `
          : canvasType === '@vuerd/builtin-grid'
            ? html`
                <div
                  class=${classMap({
                    'vuerd-menubar-menu': true,
                    active: !!filterState.filters.length,
                  })}
                  data-tippy-content="Filter [${keymapOptionsToString(
                    keymap.find
                  )}]"
                  @click=${onFilter}
                >
                  <vuerd-icon name="filter" size="16"></vuerd-icon>
                </div>
              `
            : null}
      </div>
    `;
  };
};

defineComponent('vuerd-menubar', {
  observedProps: [
    {
      name: 'focusState',
      type: Boolean,
      default: false,
    },
  ],
  style: MenubarStyle,
  render: Menubar,
});
