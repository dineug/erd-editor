import { FunctionalComponent } from 'preact';
import styled from 'styled-components';
import { SIZE_SASH } from '@/core/layout';

type Cursor =
  | 'default'
  | 'nwse-resize'
  | 'nesw-resize'
  | 'ew-resize'
  | 'ns-resize'
  | 'col-resize'
  | 'row-resize';

interface Props {
  vertical: boolean;
  horizontal: boolean;
  edge: boolean;
  cursor: Cursor;
  top: number;
  left: number;
}

type ContainerProps = Pick<Props, 'vertical' | 'horizontal' | 'edge'>;

const Container = styled.div<ContainerProps>`
  position: absolute;
  z-index: 1;
  ${props =>
    props.vertical
      ? {
          width: `${SIZE_SASH}px`,
          height: '100%',
          cursor: 'ew-resize',
        }
      : props.horizontal
      ? {
          width: '100%',
          height: `${SIZE_SASH}px`,
          cursor: 'ns-resize',
        }
      : props.edge
      ? {
          width: `${SIZE_SASH}px`,
          height: `${SIZE_SASH}px`,
        }
      : null}
`;

const Sash: FunctionalComponent<Partial<Props>> = ({
  vertical = false,
  horizontal = false,
  edge = false,
  cursor = 'default',
  top = 0,
  left = 0,
}) => {
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
    />
  );
};

export default Sash;
