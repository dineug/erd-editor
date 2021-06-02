import { Move } from '@/internal-types/event.helper';
import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';
import Sidebar from '@/components/sidebar/Sidebar';
import Editor from '@/components/editor/Editor';
import { Container } from '@/components/GenerateTemplate.styled';

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
