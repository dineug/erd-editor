import { html } from '@vuerd/lit-observable';
import { classMap } from 'lit-html/directives/class-map';
import { repeat } from 'lit-html/directives/repeat';
import { unsafeHTML } from 'lit-html/directives/unsafe-html';
import { Hint, HintState } from '@/core/hooks/tableHint.hook';

export interface HintProps {
  onSelectHint(hint: Hint): void;
}

export const hintTpl = (props: HintProps, state: HintState) => html`
  <ul class="vuerd-find-table-list">
    ${repeat(
      state.hints,
      hint => hint.id,
      hint => {
        return html`
          <li
            class=${classMap({
              'vuerd-find-table-hint': true,
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
