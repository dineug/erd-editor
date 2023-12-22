import {
  beforeMount,
  defineComponent,
  FunctionalComponent,
  html,
  watch,
} from '@vuerd/lit-observable';
import { styleMap } from 'lit-html/directives/style-map';

import { IconStyle } from '@/components/Icon.style';
import { useContext } from '@/core/hooks/context.hook';
import { useDrawerAnimation } from '@/core/hooks/drawerAnimation.hook';
import { useTooltip } from '@/core/hooks/tooltip.hook';
import { useUnmounted } from '@/core/hooks/unmounted.hook';
import { keymapOptionsToString } from '@/core/keymap';
import { DEFAULT_WIDTH } from '@/core/layout';

import { DrawerStyle } from './Drawer.style';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-drawer': DrawerElement;
  }
}

export interface DrawerProps {
  name: string;
  width: number;
  visible: boolean;
}

export interface DrawerElement extends DrawerProps, HTMLElement {}

const Drawer: FunctionalComponent<DrawerProps, DrawerElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);
  const { drawerState, getWidth, onOpen, onClose } = useDrawerAnimation(
    props,
    ctx
  );
  const { unmountedGroup } = useUnmounted();
  const { resetTooltip } = useTooltip(['.vuerd-button'], ctx);

  beforeMount(() =>
    unmountedGroup.push(
      watch(props, propName => {
        if (propName !== 'visible') return;

        props.visible ? onOpen() : onClose();
        props.visible && setTimeout(resetTooltip, 0);
      })
    )
  );

  return () => {
    const { keymap } = contextRef.value;
    const keymapStop = keymapOptionsToString(keymap.stop);

    return drawerState.visible
      ? html`
          <div
            class="vuerd-drawer"
            style=${styleMap({
              width: `${getWidth()}px`,
              right: `${drawerState.right}px`,
            })}
          >
            <div class="vuerd-drawer-header">
              <h3>${props.name}</h3>
              <vuerd-icon
                class="vuerd-button"
                name="times"
                size="16"
                data-tippy-content=${keymapStop}
                @click=${onClose}
              ></vuerd-icon>
            </div>
            <div class="vuerd-drawer-body vuerd-scrollbar">
              <slot></slot>
            </div>
          </div>
        `
      : null;
  };
};

defineComponent('vuerd-drawer', {
  observedProps: [
    {
      name: 'name',
      default: '',
    },
    {
      name: 'width',
      type: Number,
      default: DEFAULT_WIDTH,
    },
    {
      name: 'visible',
      type: Boolean,
      default: false,
    },
  ],
  style: [DrawerStyle, IconStyle].join(''),
  render: Drawer,
});
