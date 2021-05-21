import '@/components/GenerateTemplateElement';

import { Panel, PanelProps, ERDEditorContext } from 'vuerd';

export class GenerateTemplatePanel implements Panel {
  el = document.createElement('vuerd-plugin-generate-template');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
  }

  render() {
    return this.el;
  }
}
