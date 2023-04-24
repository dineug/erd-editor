import {
  createContext,
  defineCustomElement,
  FC,
  onBeforeMount,
  onMounted,
  onUnmounted,
  useProvider,
} from '@dineug/r-html';
import { Container } from 'pixi.js';

import { useContainerContext } from '@/hooks/useContainerContext';
import { useFederatedEvents } from '@/hooks/useFederatedEvents';

declare global {
  interface HTMLElementTagNameMap {
    'r-erd-container': ContainerElement;
  }
}

export const containerContext = createContext<Container | null>(null);

export type ContainerProps = {} & Pick<
  Container,
  'x' | 'y' | 'sortableChildren' | 'eventMode'
>;

export interface ContainerElement extends HTMLElement {
  container: Container;
}

const ERDContainer: FC<ContainerProps, ContainerElement> = (props, ctx) => {
  const container = new Container();
  const parentContainer = useContainerContext(ctx);
  ctx.container = container;

  let provider: ReturnType<typeof useProvider<Container | null>> | null = null;

  useFederatedEvents(container, ctx);

  onBeforeMount(() => {
    provider = useProvider(ctx, containerContext, container);
  });

  onMounted(() => {
    parentContainer.value?.addChild(container);
  });

  onUnmounted(() => {
    provider?.destroy();
    parentContainer.value?.removeChild(container);
  });

  return () => {
    const { x = 0, y = 0, sortableChildren, eventMode = 'static' } = props;

    container.eventMode = eventMode;
    container.x = x;
    container.y = y;
    container.sortableChildren = sortableChildren;
  };
};

defineCustomElement('r-erd-container', {
  shadow: false,
  observedProps: {
    x: Number,
    y: Number,
    sortableChildren: Boolean,
  },
  render: ERDContainer,
});
