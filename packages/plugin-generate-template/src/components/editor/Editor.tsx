import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar from '@/components/editor/Toolbar';

export interface Props {
  sidebarWidth: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({
  sidebarWidth = 200,
}) => {
  return (
    <Container sidebarWidth={sidebarWidth}>
      <Toolbar />
      <TemplateEditor />
    </Container>
  );
};

export default Editor;
