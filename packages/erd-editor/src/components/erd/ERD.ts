import { FC, html } from '@dineug/r-html';

import Rect from '@/components/erd/rect/Rect';
import { CustomPointerEvent } from '@/internal-types';

export type ERDProps = {};

const ERD: FC<ERDProps> = () => {
  const handleClick = (event: CustomPointerEvent) => {
    console.log('handleClick', event);
  };

  const handleClick2 = (event: CustomPointerEvent) => {
    console.log('handleClick2', event);
  };

  const handleMousedown = (event: CustomPointerEvent) => {
    console.log('handleMousedown', event);
  };

  return () => html`
    <r-erd-canvas>
      <r-erd-container sortable-children @mousedown=${handleMousedown}>
        <${Rect} x=${10} y=${10} @click=${handleClick} zIndex=${1} />
        <${Rect}
          x=${15}
          y=${15}
          color="red"
          @click=${handleClick2}
          zIndex=${0}
        />
      </r-erd-container>
    </r-erd-canvas>
  `;
};

export default ERD;
