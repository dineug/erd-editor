import '@/components/GenerateTemplateElement';

import { ERDEditorContext, Panel, PanelProps } from 'vuerd';

export class GenerateTemplatePanel implements Panel {
  el = document.createElement('vuerd-plugin-generate-template');
  props: PanelProps;

  constructor(props: PanelProps, api: ERDEditorContext) {
    this.props = props;
    this.el.api = api;
    this.setViewport();
  }

  setViewport() {
    this.el.stores.ui.setViewport({
      width: this.props.width,
      height: this.props.height,
    });
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
