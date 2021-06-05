import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';

import { useAPI } from '@/extensions/panels/visualization/hooks/api.hook';
import { Column } from '@@types/engine/store/table.state';

import { columnTpl } from './Column.template';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-visualization-column': VisualizationColumnElement;
  }
}

export interface VisualizationColumnProps {
  active: boolean;
  widthName: number;
  widthDataType: number;
  widthNotNull: number;
  widthDefault: number;
  widthComment: number;
  column: Column;
}

export interface VisualizationColumnElement
  extends VisualizationColumnProps,
    HTMLElement {}

const VisualizationColumn: FunctionalComponent<
  VisualizationColumnProps,
  VisualizationColumnElement
> = (props, ctx) => {
  const apiRef = useAPI(ctx);

  return () => {
    const { ui } = props.column;

    return html`
      <div
        class=${classMap({
          'vuerd-column': true,
          active: props.active,
        })}
      >
        <vuerd-column-key .ui=${ui}></vuerd-column-key>
        ${columnTpl(props, apiRef.value)}
      </div>
    `;
  };
};

defineComponent('vuerd-visualization-column', {
  observedProps: [
    'active',
    'widthName',
    'widthDataType',
    'widthNotNull',
    'widthDefault',
    'widthComment',
    'column',
  ],
  shadow: false,
  render: VisualizationColumn,
});
