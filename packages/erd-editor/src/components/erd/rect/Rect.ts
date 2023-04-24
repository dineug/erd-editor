import { FC, html, onMounted, onUnmounted } from '@dineug/r-html';
import { Graphics } from 'pixi.js';

import { useContainerContext } from '@/hooks/useContainerContext';
import { useFederatedEvents } from '@/hooks/useFederatedEvents';

export type RectProps = {
  color: string | number;
  x: number;
  y: number;
  width: number;
  height: number;
} & Pick<Graphics, 'eventMode' | 'zIndex'>;

const Rect: FC<RectProps> = (props, ctx) => {
  const container = useContainerContext(ctx);
  const g = new Graphics();

  useFederatedEvents(g, ctx);

  onMounted(() => {
    container.value?.addChild(g);
  });

  onUnmounted(() => {
    container.value?.removeChild(g);
  });

  return () => {
    const {
      x = 0,
      y = 0,
      width = 100,
      height = 100,
      color = 'blue',
      eventMode = 'static',
      zIndex,
    } = props;

    g.eventMode = eventMode;
    g.zIndex = zIndex;
    g.clear().beginFill(color).drawRect(x, y, width, height).endFill();

    return html`<!-- Rect -->`;
  };
};

export default Rect;
