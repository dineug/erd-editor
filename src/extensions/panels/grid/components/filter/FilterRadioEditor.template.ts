import { html } from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { FilterRadioEditorProps, RadioItem } from './FilterRadioEditor';

export interface RadioGroupProps {
  secret: string;
  activeIndex: number;
  onClick(item: RadioItem): void;
  onActiveIndex(index: number): void;
}

export const radioGroupTpl = (
  props: FilterRadioEditorProps,
  { secret, activeIndex, onClick, onActiveIndex }: RadioGroupProps
) => html`
  <ul class="vuerd-filter-radio-group">
    ${props.items.map(
      (item, index) => html`
        <li
          class=${classMap({ active: index === activeIndex })}
          @click=${() => onClick(item)}
          @mouseover=${() => onActiveIndex(index)}
        >
          <input
            type="radio"
            id=${`${secret}_${item.value}`}
            name=${secret}
            .value=${item.value}
            .checked=${props.value === item.value}
          />
          <label for=${`${secret}_${item.value}`}>${item.name}</label>
        </li>
      `
    )}
  </ul>
`;
