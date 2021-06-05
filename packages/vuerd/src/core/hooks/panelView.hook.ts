import {
  beforeFirstUpdate,
  beforeUpdate,
  html,
  observable,
} from '@vuerd/lit-observable';

import { SIZE_MENUBAR_HEIGHT } from '@/core/layout';
import { panels as globalPanels } from '@/core/panel';
import { IERDEditorContext } from '@/internal-types/ERDEditorContext';
import { ERDEditorProps } from '@@types/components/ERDEditorElement';

export function usePanelView(
  props: ERDEditorProps,
  { store: { editorState, canvasState } }: IERDEditorContext
) {
  const state = observable({ count: 0 });
  const data = {
    isPanel: false,
    canvasType: '',
  };

  const hasPanel = () => {
    const canvasType = canvasState.canvasType;
    const panels = [...globalPanels, ...editorState.panels];
    return (
      canvasType !== 'ERD' && panels.some(panel => panel.key === canvasType)
    );
  };

  const renderPanel = () =>
    queueMicrotask(() => {
      data.isPanel = true;
      state.count++;
    });

  beforeFirstUpdate(() => state.count);
  beforeUpdate(() => state.count);

  return {
    hasPanel,
    panelTpl() {
      const width = props.width;
      const height = props.height - SIZE_MENUBAR_HEIGHT;
      const canvasType = canvasState.canvasType;
      const panels = [...globalPanels, ...editorState.panels];
      const isPanel = hasPanel();

      data.isPanel = isPanel;
      if (isPanel && data.canvasType != canvasType) {
        data.isPanel = false;
        renderPanel();
      }
      data.canvasType = canvasType;

      return data.isPanel
        ? html`
            <vuerd-panel-view
              .width=${width}
              .height=${height}
              .panel=${panels.find(panel => panel.key === canvasType)}
            ></vuerd-panel-view>
          `
        : null;
    },
  };
}
