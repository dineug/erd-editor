import './Visualization';

import {
  Panel,
  PanelConfig,
  PanelProps,
  ERDEditorContext,
} from '@@types/index';
import { mdiChartBubble } from '@mdi/js';
import { addIcon } from '@/core';

class VisualizationPanel implements Panel {
  el = document.createElement('vuerd-visualization');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
    this.updated();
  }

  updated() {
    this.el.width = this.props.width;
    this.el.height = this.props.height;
  }

  render() {
    this.updated();
    return this.el;
  }
}

addIcon({
  prefix: 'mdi',
  iconName: 'chart-bubble',
  icon: [24, 24, , , mdiChartBubble],
});

export const visualizationPanelConfig: PanelConfig = {
  type: VisualizationPanel,
  icon: {
    prefix: 'mdi',
    name: 'chart-bubble',
    size: 24,
  },
  key: 'Visualization',
  name: 'Visualization',
};
