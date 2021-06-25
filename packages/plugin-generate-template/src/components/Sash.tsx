import { FunctionalComponent } from 'preact';

import { Container } from '@/components/Sash.styled';
import { SIZE_SASH } from '@/core/layout';
import { useContext } from '@/hooks/useContext';
import { Move } from '@/internal-types/event.helper';

type Cursor =
  | 'default'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'col-resize'
  | 'row-resize';

export interface Props {
  vertical: boolean;
  horizontal: boolean;
  edge: boolean;
  cursor: Cursor;
  top: number;
  left: number;
  onGlobalMove(move: Move): void;
  onMousedown(event: React.MouseEvent): void;
}

const Sash: FunctionalComponent<Partial<Props>> = ({
  vertical = false,
  horizontal = false,
  edge = false,
  cursor = 'default',
  top = 0,
  left = 0,
  onGlobalMove,
  onMousedown,
}) => {
  const context = useContext();

  const handleMousedown = (event: React.MouseEvent) => {
    if (!onGlobalMove) return;

    onMousedown && onMousedown(event);

    const { drag$ } = context.globalEvent;
    drag$.subscribe(move => {
      move.event.type === 'mousemove' && move.event.preventDefault();
      onGlobalMove(move);
    });
  };

  return (
    <Container
      style={{
        top: `${
          top === 0 && !horizontal && !edge ? top : top - SIZE_SASH / 2
        }px`,
        left: `${
          left === 0 && !vertical && !edge ? left : left - SIZE_SASH / 2
        }px`,
        cursor: edge ? cursor : '',
      }}
      vertical={vertical}
      horizontal={horizontal}
      edge={edge}
      onMouseDown={handleMousedown}
    />
  );
};

export default Sash;
