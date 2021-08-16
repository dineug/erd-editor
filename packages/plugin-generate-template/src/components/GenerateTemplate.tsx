import '@/config';

import { EditorView } from '@codemirror/view';
import { debounce } from 'lodash';
import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';

import Editor from '@/components/editor/Editor';
import { Container } from '@/components/GenerateTemplate.styled';
import Sidebar from '@/components/sidebar/Sidebar';
import {
  EDITOR_MIN_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH,
} from '@/core/layout';
import { useContext } from '@/hooks/useContext';
import { Move } from '@/internal-types/event.helper';

const GenerateTemplate: FunctionalComponent = () => {
  const [width, setWidth] = useState(SIDEBAR_WIDTH);
  const [value, setValue] = useState('');
  const [previewValue, setPreviewValue] = useState('');
  const clientXRef = useRef(0);
  const { stores } = useContext();

  const handleMousedown = ({ clientX }: React.MouseEvent) => {
    clientXRef.current = clientX;
  };

  const handleGlobalMove = ({ movementX, x }: Move) =>
    setWidth(prevWidth => {
      const width = prevWidth + movementX;
      const position = movementX < 0 ? 'left' : 'right';

      if (
        position === 'left' &&
        SIDEBAR_MIN_WIDTH <= width &&
        x < clientXRef.current
      ) {
        clientXRef.current += movementX;
        return width;
      } else if (
        position === 'right' &&
        EDITOR_MIN_WIDTH <= stores.ui.viewport.width - width &&
        x > clientXRef.current
      ) {
        clientXRef.current += movementX;
        return width;
      }

      return prevWidth;
    });

  const handleChangeMode = () => {
    setValue(previewValue);
  };

  const handleChange = useCallback(
    debounce((editor: EditorView) => {
      const text = editor.state.doc.toString();
      setPreviewValue(text);
    }, 200),
    []
  );

  return (
    <Container>
      <Sidebar
        width={width}
        onGlobalMove={handleGlobalMove}
        onMousedown={handleMousedown}
      />
      <Editor
        width={stores.ui.viewport.width - width}
        value={value}
        previewValue={previewValue}
        onChange={handleChange}
        onChangeMode={handleChangeMode}
      />
    </Container>
  );
};

export default observer(GenerateTemplate);
