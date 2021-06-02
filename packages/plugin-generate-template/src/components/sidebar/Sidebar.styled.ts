import styled from 'styled-components';
import { Props } from '@/components/sidebar/Sidebar';

type ContainerProps = Pick<Props, 'width'>;

export const Container = styled.div<ContainerProps>`
  width: ${({ width }) => `${width}px`};
  height: 100%;
  background-color: var(--vuerd-color-contextmenu);
`;
