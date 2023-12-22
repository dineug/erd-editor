import './GridEditor';

import { ERDEditorContext, Panel, PanelProps } from '@@types/index';

export class GridPanel implements Panel {
  el = document.createElement('vuerd-grid-editor');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
    this.setViewport();
  }

  setViewport() {
    this.el.width = this.props.width;
    this.el.height = this.props.height;
  }

  beforeFirstUpdate() {
    this.setViewport();
  }

  beforeUpdate() {
    this.setViewport();
  }

  render() {
    return this.el;
  }
}
