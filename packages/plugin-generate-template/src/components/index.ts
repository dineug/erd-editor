import '@/components/GenerateTemplateElement';

import { Panel, PanelProps, ERDEditorContext } from 'vuerd';

export class GenerateTemplatePanel implements Panel {
  el = document.createElement('vuerd-plugin-generate-template');
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
    this.el.render();
    return this.el;
  }
}
