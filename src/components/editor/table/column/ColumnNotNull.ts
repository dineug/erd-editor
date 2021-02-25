import { ColumnOption } from '@@types/engine/store/table.state';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_COLUMN_OPTION_NN } from '@/core/layout';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column-not-null': ColumnNotNullElement;
  }
}

export interface ColumnNotNullProps {
  focusState: boolean;
  columnOption: ColumnOption;
}

export interface ColumnNotNullElement extends ColumnNotNullProps, HTMLElement {}

const ColumnNotNull: FunctionalComponent<
  ColumnNotNullProps,
  ColumnNotNullElement
> = props => () => html`
  <div
    class=${classMap({
      'vuerd-column-not-null': true,
      focus: props.focusState,
    })}
    style=${styleMap({
      width: `${SIZE_COLUMN_OPTION_NN}px`,
    })}
  >
    ${props.columnOption.notNull ? 'N-N' : 'NULL'}
  </div>
`;

defineComponent('vuerd-column-not-null', {
  observedProps: [
    {
      name: 'focusState',
      default: false,
    },
    'columnOption',
  ],
  shadow: false,
  render: ColumnNotNull,
});
