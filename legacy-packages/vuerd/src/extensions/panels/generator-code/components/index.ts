import { Panel } from '@@types/index';

export class GeneratorCodePanel implements Panel {
  el = document.createElement('vuerd-generator-code');

  render() {
    return this.el;
  }
}
