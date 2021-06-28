import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Toolbar.styled';
import Icon from '@/components/Icon';

export type EditorMode = 'code' | 'preview' | 'vertical';

interface Props {
  mode: EditorMode;
  onChangeMode(mode: EditorMode): void;
}

const Toolbar: FunctionalComponent<Props> = ({ mode, onChangeMode }) => {
  return (
    <Container>
      <Icon
        name="file-code"
        cursor="pointer"
        size={20}
        active={mode === 'code'}
        onClick={() => onChangeMode('code')}
      />
      <Icon
        name="file-find"
        cursor="pointer"
        size={20}
        active={mode === 'preview'}
        onClick={() => onChangeMode('preview')}
      />
      <Icon
        name="view-split-vertical"
        cursor="pointer"
        size={20}
        active={mode === 'vertical'}
        onClick={() => onChangeMode('vertical')}
      />
    </Container>
  );
};

export default Toolbar;
