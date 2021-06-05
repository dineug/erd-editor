import { FunctionalComponent } from 'preact';
import Toolbar from '@/components/editor/Toolbar';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import { Container } from '@/components/editor/Editor.styled';

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
