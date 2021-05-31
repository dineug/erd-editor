import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import styled from 'styled-components';
import Sash from '@/components/Sash';

interface ContainerProps {
  width: number;
}

const Container = styled.div<ContainerProps>`
  width: ${props => `${props.width}px`};
  height: 100%;
  background-color: var(--vuerd-color-contextmenu);
`;

const Sidebar: FunctionalComponent = () => {
  const [width, setWidth] = useState(200);

  return (
    <Container width={width}>
      <Sash vertical left={200} />
    </Container>
  );
};

export default Sidebar;
