import {
  createContext,
  defineCustomElement,
  FC,
  onBeforeMount,
  onMounted,
  onUnmounted,
  useContext,
  useProvider,
} from '@dineug/r-html';
import * as PIXI from 'pixi.js';

import { canvasContext } from '@/components/erd/canvas/Canvas';

declare global {
  interface HTMLElementTagNameMap {
    'r-erd-container': ContainerElement;
  }
}

export type ContainerContext = PIXI.Container;

export const containerContext = createContext<ContainerContext | null>(null);

export interface ContainerElement extends HTMLElement {}

const Container: FC<{}, ContainerElement> = (props, ctx) => {
  const container = new PIXI.Container();
  const canvas = useContext(ctx, canvasContext);
  const parentContainer = useContext(ctx, containerContext);

  onBeforeMount(() => {
    useProvider(ctx, containerContext, container);
  });

  onMounted(() => {
    if (parentContainer.value) {
      parentContainer.value.addChild(container);
    } else {
      canvas.value?.stage.addChild(container);
    }
  });

  onUnmounted(() => {
    if (parentContainer.value) {
      parentContainer.value.removeChild(container);
    } else {
      canvas.value?.stage.removeChild(container);
    }
  });

  return () => null;
};

defineCustomElement('r-erd-container', {
  shadow: false,
  render: Container,
});
