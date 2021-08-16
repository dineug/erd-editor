import { round } from 'lodash';
import { FunctionalComponent } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

import {
  Container,
  EditorContainer,
  ResizeContainer,
} from '@/components/editor/Editor.styled';
import Preview from '@/components/editor/Preview';
import TemplateEditor from '@/components/editor/TemplateEditor';
import Toolbar, { EditorMode } from '@/components/editor/Toolbar';
import Sash from '@/components/Sash';
import { Move } from '@/internal-types/event.helper';

const MIN_WIDTH = 100;

export interface Props {
  width: number;
}

const Editor: FunctionalComponent<Partial<Props>> = ({ width = 0 }) => {
  const [mode, setMode] = useState<EditorMode>('code');
  const [containerWidth, setContainerWidth] = useState({
    editor: width / 2,
    preview: width / 2,
  });
  const prevWidthRef = useRef(width);
  const clientXRef = useRef(0);

  const handleMousedown = ({ clientX }: React.MouseEvent) => {
    clientXRef.current = clientX;
  };

  const handleGlobalMove = ({ movementX, x }: Move) =>
    setContainerWidth(prevContainerWidth => {
      const { editor, preview } = prevContainerWidth;
      const editorWidth = editor + movementX;
      const previewWidth = preview - movementX;
      const position = movementX < 0 ? 'left' : 'right';

      if (
        position === 'left' &&
        MIN_WIDTH <= editorWidth &&
        x < clientXRef.current
      ) {
        clientXRef.current += movementX;
        return {
          editor: editorWidth,
          preview: previewWidth,
        };
      } else if (
        position === 'right' &&
        MIN_WIDTH <= previewWidth &&
        x > clientXRef.current
      ) {
        clientXRef.current += movementX;
        return {
          editor: editorWidth,
          preview: previewWidth,
        };
      }

      return prevContainerWidth;
    });

  useEffect(() => {
    setContainerWidth({
      editor: width / 2,
      preview: width / 2,
    });
  }, [mode]);

  useEffect(() => {
    const prevWidth = prevWidthRef.current;
    const editorPercent = round(containerWidth.editor / prevWidth, 2);
    const previewPercent = round(containerWidth.preview / prevWidth, 2);
    const editorWidth = round(editorPercent * width, 2);
    const previewWidth = round(previewPercent * width, 2);

    if (MIN_WIDTH <= editorWidth && MIN_WIDTH <= previewWidth) {
      setContainerWidth({ editor: editorWidth, preview: previewWidth });
    } else if (MIN_WIDTH > editorWidth) {
      setContainerWidth({ editor: MIN_WIDTH, preview: width - MIN_WIDTH });
    } else if (MIN_WIDTH > previewWidth) {
      setContainerWidth({ editor: width - MIN_WIDTH, preview: MIN_WIDTH });
    } else {
      setContainerWidth({ editor: MIN_WIDTH, preview: MIN_WIDTH });
    }
    prevWidthRef.current = width;
  }, [width]);

  return (
    <Container style={{ width: `${width}px` }}>
      <Toolbar mode={mode} onChangeMode={setMode} />
      {mode === 'code' ? (
        <TemplateEditor />
      ) : mode === 'preview' ? (
        <Preview />
      ) : (
        <EditorContainer>
          <TemplateEditor width={containerWidth.editor} />
          <ResizeContainer>
            <Preview width={containerWidth.preview} />
            <Sash
              vertical
              onMousedown={handleMousedown}
              onGlobalMove={handleGlobalMove}
            />
          </ResizeContainer>
        </EditorContainer>
      )}
    </Container>
  );
};

export default Editor;
