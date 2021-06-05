import {
  defineComponent,
  FunctionalComponent,
  html,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';

import { useTooltip } from '@/core/hooks/tooltip.hook';
import { SIZE_COLUMN_OPTION_AI } from '@/core/layout';
import { ColumnOption } from '@@types/engine/store/table.state';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column-auto-increment': ColumnAutoIncrementElement;
  }
}

export interface ColumnAutoIncrementProps {
  focusState: boolean;
  columnOption: ColumnOption;
}

export interface ColumnAutoIncrementElement
  extends ColumnAutoIncrementProps,
    HTMLElement {}

const ColumnAutoIncrement: FunctionalComponent<
  ColumnAutoIncrementProps,
  ColumnAutoIncrementElement
> = (props, ctx) => {
  useTooltip(['.vuerd-column-auto-increment'], ctx);

  return () => html`
    <div
      class=${classMap({
        'vuerd-column-auto-increment': true,
        focus: props.focusState,
        checked: props.columnOption.autoIncrement,
      })}
      style=${styleMap({
        width: `${SIZE_COLUMN_OPTION_AI}px`,
      })}
      data-tippy-content="Auto Increment"
    >
      AI
    </div>
  `;
};

defineComponent('vuerd-column-auto-increment', {
  observedProps: [
    {
      name: 'focusState',
      default: false,
    },
    'columnOption',
  ],
  shadow: false,
  render: ColumnAutoIncrement,
});
