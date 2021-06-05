import { Move } from '@/internal-types/event.helper';
import { FunctionalComponent } from 'preact';
import Sash from '@/components/Sash';
import { Container } from '@/components/sidebar/Sidebar.styled';

export interface Props {
  width: number;
  onGlobalMove(move: Move): void;
}

const Sidebar: FunctionalComponent<Partial<Props>> = ({
  width = 200,
  onGlobalMove,
}) => {
  return (
    <Container width={width}>
      <Sash vertical left={width} onGlobalMove={onGlobalMove} />
    </Container>
  );
};

export default Sidebar;
