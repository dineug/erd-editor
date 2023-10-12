import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/context';

import * as styles from './Canvas.styles';

export type CanvasProps = {};

const Canvas: FC<CanvasProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  return () => {
    const { store } = app.value;
    const {
      settings: { width, height, scrollTop, scrollLeft, zoomLevel, show },
    } = store.state;

    return html`<div
      class=${styles.root}
      style=${{
        width: `${width}px`,
        height: `${height}px`,
        top: `${scrollTop}px`,
        left: `${scrollLeft}px`,
        transform: `scale(${zoomLevel})`,
      }}
    >
      Canvas
    </div>`;
  };
};

export default Canvas;
