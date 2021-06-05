import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

import Editor from '@/components/editor/Editor';
import { Container } from '@/components/GenerateTemplate.styled';
import Sidebar from '@/components/sidebar/Sidebar';
import { Move } from '@/internal-types/event.helper';

const GenerateTemplate: FunctionalComponent = () => {
  const [width, setWidth] = useState(200);

  const onGlobalMove = ({ movementX }: Move) => {
    setWidth(prevState => prevState + movementX);
  };

  return (
    <Container>
      <Sidebar width={width} onGlobalMove={onGlobalMove} />
      <Editor sidebarWidth={width} />
    </Container>
  );
};

export default GenerateTemplate;
