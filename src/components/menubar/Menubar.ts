import './MenuGroup';

import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { useContext } from '@/core/hooks/context.hook';
import {
  changeDatabaseName,
  resizeCanvas,
  zoomCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { onNumberOnly } from '@/core/helper/dom.helper';
import {
  canvasSizeRange,
  zoomLevelRange,
  zoomDisplayFormat,
} from '@/engine/store/canvas.helper';
import { useTooltip } from '@/core/hooks/tooltip.hook';
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
  useTooltip(['.vuerd-menubar-input'], ctx);

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

  return () => {
    const { canvasState } = contextRef.value.store;

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
          .value=${canvasState.databaseName}
          @input=${onChangeDatabaseName}
        />
        <input
          class="vuerd-menubar-input"
          style="width: 45px;"
          type="text"
          data-tippy-content="canvas size"
          spellcheck="false"
          placeholder="canvas size"
          .value=${canvasState.width.toString()}
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
          .value=${zoomDisplayFormat(canvasState.zoomLevel)}
          @input=${onNumberOnly}
          @change=${onZoomLevel}
        />
        <vuerd-menu-group></vuerd-menu-group>
        <div class="vuerd-menubar-menu-vertical"></div>
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
