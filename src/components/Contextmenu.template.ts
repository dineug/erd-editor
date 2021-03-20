import { Menu } from '@@types/core/contextmenu';
import { html } from '@dineug/lit-observable';

export const iconTpl = (menu: Menu) =>
  menu.icon
    ? html`
        <span class="icon">
          <vuerd-icon
            .prefix=${menu.icon.prefix}
            .size=${menu.icon.size || 14}
            name=${menu.icon.name}
          >
          </vuerd-icon>
        </span>
      `
    : menu.iconBase64
    ? html`
        <span class="icon">
          <img src=${menu.iconBase64} />
        </span>
      `
    : html`<span class="icon"></span>`;
