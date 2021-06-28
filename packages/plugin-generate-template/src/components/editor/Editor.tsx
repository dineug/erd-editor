import { FunctionalComponent } from 'preact';
import { useState } from 'preact/hooks';

import { Container } from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar, { EditorMode } from '@/components/editor/Toolbar';

export interface Props {
  width: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({ width = 0 }) => {
  const [mode, setMode] = useState<EditorMode>('code');

  return (
    <Container style={{ width: `${width}px` }}>
      <Toolbar mode={mode} onChangeMode={setMode} />
      {mode === 'code' ? <TemplateEditor /> : <Preview />}
    </Container>
  );
};

export default Editor;
