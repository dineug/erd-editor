import {
  defineComponent,
  html,
  FunctionalComponent,
  watch,
  beforeMount,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import {
  changeDatabaseName,
  resizeCanvas,
  zoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { findActive$ } from '@/engine/command/editor.cmd.helper';
import {
  canvasSizeRange,
  zoomLevelRange,
  zoomDisplayFormat,
} from '@/engine/store/helper/canvas.helper';
import { onNumberOnly } from '@/core/helper/dom.helper';
import { Bus } from '@/core/helper/eventBus.helper';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useMenubarPanels } from '@/core/hooks/menubarPanels.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { useContext } from '@/core/hooks/context.hook';
import { panels } from '@/core/panel';
import { keymapOptionsToString } from '@/core/keymap';
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
    ['.vuerd-menubar-input', '.vuerd-menubar-menu'],
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
    store.dispatch(findActive$());
    eventBus.emit(Bus.Drawer.close);
  };

  const onOpenHelp = () => ctx.dispatchEvent(new CustomEvent('open-help'));
  const onOpenSetting = () =>
    ctx.dispatchEvent(new CustomEvent('open-setting'));

  beforeMount(() => {
    const { editorState } = contextRef.value.store;

    unmountedGroup.push(
      watch(editorState.panels, () => resetTooltip()),
      watch(panels, () => resetTooltip())
    );
  });

  return () => {
    const { store, keymap } = contextRef.value;
    const {
      canvasState: { databaseName, width, zoomLevel, canvasType },
    } = store;

    return html`
      <div
        class=${classMap({
          'vuerd-menubar': true,
          focus: props.focusState, // TODO: readonly mode
          edit: props.focusState,
        })}
      >
        <input
          class="vuerd-menubar-input"
          style="width: 150px;"
          type="text"
          data-tippy-content="database name"
          placeholder="database name"
          spellcheck="false"
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
