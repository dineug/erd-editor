import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';

import { useContext } from '@/core/hooks/context.hook';
import { ColumnType } from '@@types/engine/store/canvas.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-tree-drawer': TreeDrawerElement;
  }
}

export interface TreeDrawerProps {
  width: number;
  visible: boolean;
}

export interface TreeDrawerElement extends TreeDrawerProps, HTMLElement {}

interface TreeDrawerState {
  currentColumnType: ColumnType | null;
}

const TreeDrawer: FunctionalComponent<TreeDrawerProps, TreeDrawerElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);

  // const { store } = contextRef.value;

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  return () => html`
    <vuerd-drawer
      name="Tree"
      .width=${props.width}
      .visible=${props.visible}
      @close=${onClose}
    >
      <div class="vuerd-tree-drawer">
        <div>----TEST----</div>
      </div>
    </vuerd-drawer>
  `;
};

defineComponent('vuerd-tree-drawer', {
  observedProps: ['width', 'visible'],
  shadow: false,
  render: TreeDrawer,
});
