import styled from 'styled-components';

import { Props } from '@/components/Sash';
import { SIZE_SASH } from '@/core/layout';

type ContainerProps = Pick<Props, 'vertical' | 'horizontal' | 'edge'>;

export const Container = styled.div<ContainerProps>`
  position: absolute;
  z-index: 1;
  ${({ vertical, horizontal, edge }) =>
    vertical
      ? {
          width: `${SIZE_SASH}px`,
          height: '100%',
          cursor: 'ew-resize',
        }
      : horizontal
      ? {
          width: '100%',
          height: `${SIZE_SASH}px`,
          cursor: 'ns-resize',
        }
      : edge
      ? {
          width: `${SIZE_SASH}px`,
          height: `${SIZE_SASH}px`,
        }
      : null}
`;
