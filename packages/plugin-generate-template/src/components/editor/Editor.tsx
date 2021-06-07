import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar from '@/components/editor/Toolbar';
import { SIDEBAR_WIDTH } from '@/core/layout';
import { useContext } from '@/hooks/useContext';

export interface Props {
  sidebarWidth: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({
  sidebarWidth = SIDEBAR_WIDTH,
}) => {
  const { stores } = useContext();

  return (
    <Container
      style={{ width: `${stores.ui.viewport.width - sidebarWidth}px` }}
    >
      <Toolbar />
      <TemplateEditor />
    </Container>
  );
};

export default Editor;
