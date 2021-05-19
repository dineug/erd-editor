import './Visualization';

import { Panel, PanelProps, ERDEditorContext } from '@@types/index';

export class VisualizationPanel implements Panel {
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
