import { ERDEditorContext } from '@@types/index';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-visualization': VisualizationElement;
  }
}

export interface VisualizationProps {
  width: number;
  height: number;
}

export interface VisualizationElement extends VisualizationProps, HTMLElement {
  api: ERDEditorContext;
}

const Visualization: FunctionalComponent<
  VisualizationProps,
  VisualizationElement
> = (props, ctx) => {
  return () => html`<div>visualization</div>`;
};

defineComponent('vuerd-visualization', {
  observedProps: [
    {
      name: 'width',
      default: 0,
    },
    {
      name: 'height',
      default: 0,
    },
  ],
  styleMap: {
    width: '100%',
    height: '100%',
  },
  render: Visualization,
});
