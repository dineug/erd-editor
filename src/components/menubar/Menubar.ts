import './MenuGroup';

import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { useContext } from '@/core/hooks/context.hook';
import {
  changeDatabaseName,
  resizeCanvas,
} from '@/engine/command/canvas.cmd.helper';
import { onNumberOnly } from '@/core/helper/dom.helper';
import { canvasSizeRange } from '@/engine/store/canvas.helper';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { MenubarStyle } from './Menubar.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-menubar': MenubarElement;
  }
}

export interface MenubarProps {}

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

  return () => {
    const { canvasState } = contextRef.value.store;

    return html`
      <div class="vuerd-menubar">
        <input
          class="vuerd-menubar-input"
          style="width: 200px;"
          type="text"
          data-tippy-content="database name"
          placeholder="database name"
          spellcheck="false"
          .value=${canvasState.databaseName}
          @input=${onChangeDatabaseName}
        />
        <input
          class="vuerd-menubar-input"
          style="width: 65px;"
          type="text"
          data-tippy-content="canvas size"
          spellcheck="false"
          placeholder="canvas size"
          .value=${canvasState.width.toString()}
          @input=${onNumberOnly}
          @change=${onResizeCanvas}
        />
        <vuerd-menu-group></vuerd-menu-group>
        <div class="vuerd-menubar-menu-vertical"></div>
      </div>
    `;
  };
};

defineComponent('vuerd-menubar', {
  style: MenubarStyle,
  render: Menubar,
});
