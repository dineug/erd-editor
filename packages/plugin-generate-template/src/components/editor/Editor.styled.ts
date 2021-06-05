import styled from 'styled-components';
import { Props } from '@/components/editor/Editor';

type ContainerProps = Pick<Props, 'sidebarWidth'>;

export const Container = styled.div<ContainerProps>`
  width: ${({ sidebarWidth }) => `calc(100% - ${sidebarWidth}px)`};
  height: 100%;
  display: flex;
  flex-direction: column;
`;
