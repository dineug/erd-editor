import '@/config';

import { EditorView } from '@codemirror/view';
import { debounce } from 'lodash';
import { observer } from 'mobx-react-lite';
import { FunctionalComponent } from 'preact';
import { useCallback, useRef, useState } from 'preact/hooks';

import Editor from '@/components/editor/Editor';
import { Container } from '@/components/GenerateTemplate.styled';
import Sidebar from '@/components/sidebar/Sidebar';
import { encodeBase64 } from '@/core/helper';
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
  const templateUUIDRef = useRef<string | null>(null);
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

      if (!templateUUIDRef.current) return;
      const template = stores.template.templates.find(
        data => data.uuid === templateUUIDRef.current
      );
      if (!template) return;

      stores.template.update({
        uuid: template.uuid,
        name: template.name,
        value: text,
      });
    }, 200),
    []
  );

  const handleChangeTemplate = (uuid: string) => {
    const template = stores.template.templates.find(data => data.uuid === uuid);
    if (!template) return;
    templateUUIDRef.current = uuid;
    setValue(template.value);
    setPreviewValue(template.value);
    console.log(`template ${template.name}`, encodeBase64(template.value));
  };

  return (
    <Container>
      <Sidebar
        width={width}
        onGlobalMove={handleGlobalMove}
        onMousedown={handleMousedown}
        onChangeTemplate={handleChangeTemplate}
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
