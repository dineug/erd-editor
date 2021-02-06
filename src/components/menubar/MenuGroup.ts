import { PanelConfig } from '@@types/core/panel';
import { IIcon } from '@/internal-types/panel';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { getVuerdContextRef } from '@/components/ERDEditorProvider';
import { changeCanvasType } from '@/engine/command/canvas.command.helper';
import { panels } from '@/core/panel';
import { MenuGroupStyle } from './MenuGroup.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-menu-group': MenuGroupElement;
  }
}

export interface MenuGroupProps {}

export interface MenuGroupElement extends MenuGroupProps, HTMLElement {}

interface Menu {
  title: string;
  canvasType: string;
  icon: IIcon;
}

const ERD = {
  title: 'ERD',
  canvasType: 'ERD',
  icon: {
    prefix: 'fas',
    name: 'project-diagram',
    size: 18,
  },
};

const panelToMenu = (panel: PanelConfig): Menu => ({
  title: panel.name ?? '',
  canvasType: panel.key,
  icon: Object.assign(
    {
      size: 18,
    },
    panel.icon
  ),
});

const MenuGroup: FunctionalComponent<MenuGroupProps, MenuGroupElement> = (
  props,
  ctx
) => {
  const contextRef = getVuerdContextRef(ctx);

  const onChangeCanvasType = (canvasType: string) => {
    const { store } = contextRef.value;

    if (canvasType === store.canvasState.canvasType) return;

    store.dispatch(changeCanvasType(canvasType));
  };

  return () => {
    const { canvasState, editorState } = contextRef.value.store;
    const menus: Menu[] = [ERD];
    [...panels, ...editorState.panels].forEach(panel =>
      menus.push(panelToMenu(panel))
    );

    return html`${menus.map(
      menu => html`
        <div
          class=${classMap({
            'vuerd-menubar-menu': true,
            active: canvasState.canvasType === menu.canvasType,
          })}
          title=${menu.canvasType}
          @click=${() => onChangeCanvasType(menu.canvasType)}
        >
          <vuerd-icon
            .prefix=${menu.icon.prefix}
            .name=${menu.icon.name}
            .size=${menu.icon.size}
          ></vuerd-icon>
        </div>
      `
    )}`;
  };
};

defineComponent('vuerd-menu-group', {
  styleMap: {
    display: 'flex',
    alignItems: 'center',
  },
  style: MenuGroupStyle,
  render: MenuGroup,
});
