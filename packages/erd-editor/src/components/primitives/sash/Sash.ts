import { FC, html } from '@dineug/r-html';

import { ValuesType } from '@/internal-types';
import { drag$, DragMove } from '@/utils/globalEventObservable';

import * as styles from './Sash.styles';

export const Cursor = {
  default: 'default',
  ewResize: 'ew-resize',
  nsResize: 'ns-resize',
  neswResize: 'nesw-resize',
  nwseResize: 'nwse-resize',
} as const;
export type Cursor = ValuesType<typeof Cursor>;

export const SashType = {
  vertical: 'vertical',
  horizontal: 'horizontal',
  edge: 'edge',
} as const;
export type SashType = ValuesType<typeof SashType>;

export type SashProps = {
  type: SashType;
  cursor?: Cursor;
  top?: number;
  left?: number;
  onMove?: (dragMove: DragMove) => void;
  onMousedown?: (event: MouseEvent) => void;
};

const Sash: FC<SashProps> = (props, ctx) => {
  const centerTop = () => {
    const top = props.top ?? 0;
    return top === 0 && props.type === SashType.vertical
      ? top
      : top - styles.SASH_SIZE / 2;
  };

  const centerLeft = () => {
    const left = props.left ?? 0;
    return left === 0 && props.type === SashType.horizontal
      ? left
      : left - styles.SASH_SIZE / 2;
  };

  const handleMousedown = (event: MouseEvent) => {
    props.onMousedown?.(event);
    drag$.subscribe(dragMove => {
      dragMove.event.type === 'mousemove' && dragMove.event.preventDefault();
      props.onMove?.(dragMove);
    });
  };

  return () => {
    const vertical = props.type === SashType.vertical;
    const horizontal = props.type === SashType.horizontal;
    const edge = props.type === SashType.edge;

    return html`
      <div
        class=${[
          'sash',
          styles.sash,
          {
            vertical,
            horizontal,
            edge,
          },
        ]}
        style=${{
          top: `${centerTop()}px`,
          left: `${centerLeft()}px`,
          cursor: edge ? props.cursor : '',
        }}
        @mousedown=${handleMousedown}
      ></div>
    `;
  };
};

export default Sash;
