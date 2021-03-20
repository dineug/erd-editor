import { PanelConfig } from '@@types/core/panel';
import { IIcon } from '@/internal-types/panel';
import { html } from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { useContext } from './context.hook';
import { changeCanvasType } from '@/engine/command/canvas.cmd.helper';
import { panels } from '@/core/panel';

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

export function useMenubarPanels(ctx: HTMLElement) {
  const contextRef = useContext(ctx);

  const onChangeCanvasType = (canvasType: string) => {
    const { store } = contextRef.value;

    if (canvasType === store.canvasState.canvasType) return;

    store.dispatch(changeCanvasType(canvasType));
  };

  const getMenus = () => {
    const { editorState } = contextRef.value.store;
    const menus: Menu[] = [ERD];
    [...panels, ...editorState.panels].forEach(panel =>
      menus.push(panelToMenu(panel))
    );

    return menus;
  };

  return {
    panelMenusTpl: () => {
      const { canvasState } = contextRef.value.store;

      return getMenus().map(
        menu => html`
          <div
            class=${classMap({
              'vuerd-menubar-menu': true,
              active: canvasState.canvasType === menu.canvasType,
            })}
            data-tippy-content=${menu.title}
            @click=${() => onChangeCanvasType(menu.canvasType)}
          >
            <vuerd-icon
              .prefix=${menu.icon.prefix}
              .name=${menu.icon.name}
              .size=${menu.icon.size}
            ></vuerd-icon>
          </div>
        `
      );
    },
  };
}
