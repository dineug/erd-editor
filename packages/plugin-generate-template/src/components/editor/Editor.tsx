import { FunctionalComponent } from 'preact';
import styled from 'styled-components';
import Toolbar from '@/components/editor/Toolbar';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';

const Container = styled.div`
  width: calc(100% - 200px);
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const Editor: FunctionalComponent = () => {
  return (
    <Container>
      <Toolbar />
      <TemplateEditor />
    </Container>
  );
};

export default Editor;
