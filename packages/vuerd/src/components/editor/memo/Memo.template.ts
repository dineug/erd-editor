import { html } from '@vuerd/lit-observable';

import { SashProps } from '@/components/Sash';
import { Position } from '@/core/hooks/resizeMemo.hook';

const createSash = (
  top: number,
  left: number
): Array<{ position: Position } & Partial<SashProps>> => [
  {
    vertical: true,
    position: 'left',
  },
  {
    vertical: true,
    position: 'right',
    left,
  },
  // {
  //   horizontal: true,
  //   position: 'top',
  // },
  {
    horizontal: true,
    position: 'bottom',
    top,
  },
  {
    edge: true,
    position: 'lt',
    cursor: 'nwse-resize',
  },
  {
    edge: true,
    position: 'rt',
    cursor: 'nesw-resize',
    left,
  },
  {
    edge: true,
    position: 'lb',
    cursor: 'nesw-resize',
    top,
  },
  {
    edge: true,
    position: 'rb',
    cursor: 'nwse-resize',
    top,
    left,
  },
];

export const sashTpl = (
  top: number,
  left: number,
  onMousedownSash: (event: MouseEvent, position: Position) => void
) =>
  createSash(top, left).map(
    sash =>
      html`
        <vuerd-sash
          ?vertical=${sash.vertical}
          ?horizontal=${sash.horizontal}
          ?edge=${sash.edge}
          .cursor=${sash.cursor}
          .top=${sash.top ?? 0}
          .left=${sash.left ?? 0}
          @mousedown=${(event: MouseEvent) =>
            onMousedownSash(event, sash.position)}
        ></vuerd-sash>
      `
  );
