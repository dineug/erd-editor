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

export interface VisualizationProps {}

export interface VisualizationElement extends VisualizationProps, HTMLElement {}

const Visualization: FunctionalComponent<
  VisualizationProps,
  VisualizationElement
> = (props, ctx) => {
  return () => html`<div>visualization</div>`;
};

defineComponent('vuerd-visualization', {
  render: Visualization,
});
