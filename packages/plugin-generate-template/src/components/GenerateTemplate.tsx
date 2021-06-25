import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useRef, useState } from 'preact/hooks';

import Editor from '@/components/editor/Editor';
import { Container } from '@/components/GenerateTemplate.styled';
import Sidebar from '@/components/sidebar/Sidebar';
import {
  EDITOR_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
} from '@/core/layout';
import { useContext } from '@/hooks/useContext';
import { Move } from '@/internal-types/event.helper';

const GenerateTemplate: FunctionalComponent = () => {
  const [width, setWidth] = useState(SIDEBAR_WIDTH);
  const clientXRef = useRef(0);
  const { stores } = useContext();

  const handleMousedown = ({ clientX }: React.MouseEvent) => {
    clientXRef.current = clientX;
  };

  const handleGlobalMove = ({ movementX, x }: Move) =>
    setWidth(prevWidth => {
      const width = prevWidth + movementX;
      const position = movementX < 0 ? 'left' : 'right';

      if (
        position === 'left' &&
        SIDEBAR_MIN_WIDTH <= width &&
        x < clientXRef.current
      ) {
        clientXRef.current += movementX;
        return width;
      } else if (
        position === 'right' &&
        EDITOR_MIN_WIDTH <= stores.ui.viewport.width - width &&
        x > clientXRef.current
      ) {
        clientXRef.current += movementX;
        return width;
      }

      return prevWidth;
    });

  return (
    <Container>
      <Sidebar
        width={width}
        onGlobalMove={handleGlobalMove}
        onMousedown={handleMousedown}
      />
      <Editor width={stores.ui.viewport.width - width} />
    </Container>
  );
};

export default observer(GenerateTemplate);
