import { FunctionalComponent } from 'preact';

import { Container } from '@/components/editor/Toolbar.styled';
import Icon from '@/components/Icon';
import { useTooltip } from '@/hooks/useTooltip';

export type EditorMode = 'code' | 'preview' | 'vertical' | 'help';

interface Props {
  mode: EditorMode;
  onChangeMode(mode: EditorMode): void;
}

const Toolbar: FunctionalComponent<Props> = ({ mode, onChangeMode }) => {
  const [tooltipRef] = useTooltip(4);

  return (
    <Container>
      <div
        class="tooltip"
        data-tippy-content="Template and Preview"
        ref={tooltipRef.current[2]}
      >
        <Icon
          name="view-split-vertical"
          cursor="pointer"
          size={20}
          active={mode === 'vertical'}
          onClick={() => onChangeMode('vertical')}
        />
      </div>
      <div
        class="tooltip"
        data-tippy-content="Template"
        ref={tooltipRef.current[0]}
      >
        <Icon
          name="file-code"
          cursor="pointer"
          size={20}
          active={mode === 'code'}
          onClick={() => onChangeMode('code')}
        />
      </div>
      <div
        class="tooltip"
        data-tippy-content="Preview"
        ref={tooltipRef.current[1]}
      >
        <Icon
          name="file-find"
          cursor="pointer"
          size={20}
          active={mode === 'preview'}
          onClick={() => onChangeMode('preview')}
        />
      </div>
      <div
        class="tooltip"
        data-tippy-content="Help"
        ref={tooltipRef.current[3]}
      >
        <Icon
          name="file-question"
          cursor="pointer"
          size={20}
          active={mode === 'help'}
          onClick={() => onChangeMode('help')}
        />
      </div>
    </Container>
  );
};

export default Toolbar;
