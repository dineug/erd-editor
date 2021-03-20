import { Menu } from '@@types/core/contextmenu';
import {
  defineComponent,
  html,
  FunctionalComponent,
  observable,
  unmounted,
  query,
  watch,
} from '@dineug/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_CONTEXTMENU_HEIGHT } from '@/core/layout';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { iconTpl } from './Contextmenu.template';
import { ContextmenuStyle } from './Contextmenu.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-contextmenu': ContextmenuElement;
  }
}

export interface ContextmenuProps {
  x: number;
  y: number;
  menus: Menu[];
}

export interface ContextmenuElement extends ContextmenuProps, HTMLElement {}

interface ContextmenuState {
  menu: Menu | null;
}

const Contextmenu: FunctionalComponent<ContextmenuProps, ContextmenuElement> = (
  props,
  ctx
) => {
  const state = observable<ContextmenuState>({ menu: null });
  const rootRef = query<HTMLElement>('.vuerd-contextmenu');
  const { unmountedGroup } = useUnmounted();
  const { resetTooltip } = useTooltip(['.keymap'], ctx);

  const childrenX = () => {
    const ul = rootRef.value;
    return ul ? props.x + ul.clientWidth : props.x;
  };

  const childrenY = () =>
    state.menu
      ? props.y + props.menus.indexOf(state.menu) * SIZE_CONTEXTMENU_HEIGHT
      : props.y;

  const onMouseover = (menu: Menu) => (state.menu = menu);
  const onClose = () => ctx.dispatchEvent(new CustomEvent('close-contextmenu'));
  const onExecute = (menu: Menu) => {
    if (!menu.execute || menu.children?.length) return;

    menu.execute();

    if (!menu.options || menu.options.close !== false) {
      onClose();
    }
  };

  const createContextmenuEvent = (eventName: string) => (event: Event) => {
    event.stopPropagation();
    ctx.dispatchEvent(
      new CustomEvent(eventName, {
        composed: true,
        bubbles: true,
      })
    );
  };

  const onMousedown = createContextmenuEvent('vuerd-contextmenu-mousedown');
  const onTouchstart = createContextmenuEvent('vuerd-contextmenu-touchstart');

  unmountedGroup.push(
    watch(props, propName => {
      if (propName !== 'menus') return;

      resetTooltip();
    })
  );

  unmounted(() => (state.menu = null));

  return () =>
    html`
      <ul
        class="vuerd-contextmenu"
        style=${styleMap({
          left: `${props.x}px`,
          top: `${props.y}px`,
        })}
        @mousedown=${onMousedown}
        @touchstart=${onTouchstart}
      >
        ${props.menus.map(
          menu => html`
            <li
              @mouseover=${() => onMouseover(menu)}
              @click=${() => onExecute(menu)}
            >
              ${iconTpl(menu)}
              <span
                class="name"
                style=${styleMap({
                  width: `${menu.options?.nameWidth ?? 70}px`,
                })}
                title=${menu.name}
              >
                ${menu.name}
              </span>
              <span
                class="keymap"
                style=${styleMap({
                  width: `${menu.options?.keymapWidth ?? 60}px`,
                })}
                data-tippy-content=${menu.keymapTooltip
                  ? menu.keymapTooltip
                  : ''}
              >
                ${menu.keymap}
              </span>
              ${menu.children && menu.children.length
                ? html`
                    <span class="arrow">
                      <vuerd-icon size="13" name="chevron-right"></vuerd-icon>
                    </span>
                  `
                : null}
            </li>
          `
        )}
      </ul>
      ${state.menu?.children?.length
        ? html`
            <vuerd-contextmenu
              .menus=${state.menu.children}
              .x=${childrenX()}
              .y=${childrenY()}
              @close-contextmenu=${onClose}
            ></vuerd-contextmenu>
          `
        : null}
    `;
};

defineComponent('vuerd-contextmenu', {
  observedProps: [
    {
      name: 'x',
      type: Number,
      default: 0,
    },
    {
      name: 'y',
      type: Number,
      default: 0,
    },
    'menus',
  ],
  style: ContextmenuStyle,
  render: Contextmenu,
});
