import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';

import { ColumnUI } from '@@types/engine/store/table.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column-key': ColumnKeyElement;
  }
}

export interface ColumnKeyProps {
  ui: ColumnUI;
  color?: string;
}

export interface ColumnKeyElement extends ColumnKeyProps, HTMLElement {}

const ColumnKey: FunctionalComponent<ColumnKeyProps, ColumnKeyElement> = (
  props,
  ctx
) => {
  return () => html`
    <div
      class=${classMap({
        'vuerd-column-key': true,
        pk: props.ui.pk,
        fk: props.ui.fk,
        pfk: props.ui.pfk,
      })}
      style=${styleMap({ fill: props.color || '' })}
    >
      <vuerd-icon size="12" name="key"></vuerd-icon>
    </div>
  `;
};

defineComponent('vuerd-column-key', {
  observedProps: ['ui', 'color'],
  shadow: false,
  styleMap: {
    display: 'flex',
    height: '100%',
    alignItems: 'center',
  },
  render: ColumnKey,
});
