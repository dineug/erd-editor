import './GeneratorCode';

import { Panel, PanelProps, ERDEditorContext } from '@@types/index';

export class GeneratorCodePanel implements Panel {
  el = document.createElement('vuerd-generator-code');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
  }

  render() {
    return this.el;
  }
}
