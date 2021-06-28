import { FunctionalComponent } from 'preact';

import Sash from '@/components/Sash';
import { Container } from '@/components/sidebar/Sidebar.styled';
import { SIDEBAR_WIDTH } from '@/core/layout';
import { Move } from '@/internal-types/event.helper';

export interface Props {
  width: number;
  onGlobalMove(move: Move): void;
  onMousedown(event: React.MouseEvent): void;
}

const Sidebar: FunctionalComponent<Partial<Props>> = ({
  width = SIDEBAR_WIDTH,
  onGlobalMove,
  onMousedown,
}) => {
  return (
    <Container style={{ width: `${width}px` }}>
      <Sash
        vertical
        left={width}
        onGlobalMove={onGlobalMove}
        onMousedown={onMousedown}
      />
    </Container>
  );
};

export default Sidebar;
