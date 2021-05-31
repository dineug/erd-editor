import { FunctionalComponent } from 'preact';
import styled from 'styled-components';
import Sidebar from '@/components/sidebar/Sidebar';
import Editor from '@/components/editor/Editor';

const Container = styled.div`
  display: flex;
  height: 100%;
  background-color: var(--vuerd-color-canvas);
`;

const GenerateTemplate: FunctionalComponent = () => {
  return (
    <Container>
      <Sidebar />
      <Editor />
    </Container>
  );
};

export default GenerateTemplate;
