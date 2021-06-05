import './GridEditor';

import { ERDEditorContext, Panel, PanelProps } from '@@types/index';

export class GridPanel implements Panel {
  el = document.createElement('vuerd-grid-editor');
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
