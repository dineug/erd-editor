import { html, mounted, query } from '@vuerd/lit-observable';

import { IHelper } from '@/internal-types/helper';

export function ghostTpl(helper: IHelper) {
  const ghostTextRef = query<HTMLSpanElement>('.vuerd-ghost-text-helper');
  const ghostInputRef = query<HTMLInputElement>('.vuerd-ghost-focus-helper');

  mounted(() => {
    helper.setGhostText(ghostTextRef.value);
    helper.setGhostInput(ghostInputRef.value);
    helper.focus();
  });

  return html`
    <input class="vuerd-ghost-focus-helper" type="text" />
    <span class="vuerd-ghost-text-helper"></span>
  `;
}
