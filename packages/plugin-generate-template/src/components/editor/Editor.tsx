import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar from '@/components/editor/Toolbar';
import { SIDEBAR_WIDTH } from '@/core/layout';

export interface Props {
  sidebarWidth: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({
  sidebarWidth = SIDEBAR_WIDTH,
}) => {
  return (
    <Container style={{ width: `calc(100% - ${sidebarWidth}px)` }}>
      <Toolbar />
      <TemplateEditor />
    </Container>
  );
};

export default Editor;
