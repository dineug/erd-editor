import { html } from '@dineug/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { Hint, HintState } from '@/core/hooks/dataTypeHint.hook';

export interface DataTypeHintProps {
  onSelectHint(hint: Hint): void;
}

export const dataTypeHintTpl = (
  props: DataTypeHintProps,
  state: HintState
) => html`
  <ul class="vuerd-column-data-type-hint">
    ${repeat(
      state.hints,
      hint => hint.name,
      hint => {
        return html`
          <li
            class=${classMap({
              'vuerd-data-type-hint': true,
              active: hint.active,
            })}
            @click=${() => props.onSelectHint(hint)}
          >
            ${unsafeHTML(hint.html)}
          </li>
        `;
      }
    )}
  </ul>
`;
