import { FunctionalComponent } from 'preact';

import { Container } from '@/components/Sash.styled';
import { useContext } from '@/core/hooks/useContext';
import { SIZE_SASH } from '@/core/layout';
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
}

const Sash: FunctionalComponent<Partial<Props>> = ({
  vertical = false,
  horizontal = false,
  edge = false,
  cursor = 'default',
  top = 0,
  left = 0,
  onGlobalMove,
}) => {
  const context = useContext();

  const onMousedown = () => {
    if (!onGlobalMove) return;

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
      onMouseDown={onMousedown}
    />
  );
};

export default Sash;
