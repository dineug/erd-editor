import styled from 'styled-components';

import { Cursor } from '@/components/Icon';

export const Container = styled.div<{ cursor: Cursor }>`
  height: 100%;
  display: inline-flex;
  align-items: center;
  fill: var(--vuerd-color-font);
  cursor: ${({ cursor }) => cursor};
  &:hover {
    fill: var(--vuerd-color-font-active);
  }
`;

export const Canvas = styled.svg<{ transition: boolean }>`
  ${({ transition }) => (transition ? `transition: fill 0.15s;` : null)}
`;
