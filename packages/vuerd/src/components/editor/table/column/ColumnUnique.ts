import { ColumnOption } from '@@types/engine/store/table.state';
import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { styleMap } from 'lit-html/directives/style-map';
import { SIZE_COLUMN_OPTION_UQ } from '@/core/layout';
import { useTooltip } from '@/core/hooks/tooltip.hook';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-column-unique': ColumnUniqueElement;
  }
}

export interface ColumnUniqueProps {
  focusState: boolean;
  columnOption: ColumnOption;
}

export interface ColumnUniqueElement extends ColumnUniqueProps, HTMLElement {}

const ColumnUnique: FunctionalComponent<
  ColumnUniqueProps,
  ColumnUniqueElement
> = (props, ctx) => {
  useTooltip(['.vuerd-column-unique'], ctx);

  return () => html`
    <div
      class=${classMap({
        'vuerd-column-unique': true,
        focus: props.focusState,
        checked: props.columnOption.unique,
      })}
      style=${styleMap({
        width: `${SIZE_COLUMN_OPTION_UQ}px`,
      })}
      data-tippy-content="Unique"
    >
      UQ
    </div>
  `;
};

defineComponent('vuerd-column-unique', {
  observedProps: [
    {
      name: 'focusState',
      default: false,
    },
    'columnOption',
  ],
  shadow: false,
  render: ColumnUnique,
});
