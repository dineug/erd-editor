import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar from '@/components/editor/Toolbar';

export interface Props {
  width: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({ width = 0 }) => {
  return (
    <Container style={{ width: `${width}px` }}>
      <Toolbar />
      <TemplateEditor />
    </Container>
  );
};

export default Editor;
