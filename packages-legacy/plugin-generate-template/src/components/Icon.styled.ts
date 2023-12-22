import styled from 'styled-components';

import { Props } from '@/components/Icon';

export const Container = styled.div<Pick<Props, 'cursor' | 'active'>>`
  height: 100%;
  display: inline-flex;
  align-items: center;
  fill: ${({ active }) =>
    active ? 'var(--vuerd-color-font-active)' : 'var(--vuerd-color-font)'};
  cursor: ${({ cursor }) => cursor};
  &:hover {
    fill: var(--vuerd-color-font-active);
  }
`;

export const Canvas = styled.svg<Pick<Props, 'transition'>>`
  ${({ transition }) => (transition ? `transition: fill 0.15s;` : null)}
`;
