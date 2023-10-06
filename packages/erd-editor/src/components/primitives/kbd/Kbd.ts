import { FC, html } from '@dineug/r-html';

import { shortcutToTuple } from '@/keyboard-shortcut';

import * as styles from './Kbd.styles';

export type KbdProps = {
  shortcut?: string;
};

const Kbd: FC<KbdProps> = (props, ctx) => {
  return () => {
    const keys = shortcutToTuple(props.shortcut);
    const shortcuts = keys.map(([mods, key]) => [...mods, key].join(' + '));

    return html`
      <div class=${styles.root}>
        ${shortcuts.map(
          shortcut => html`<div class=${styles.kbd}>${shortcut}</div>`
        )}
      </div>
    `;
  };
};

export default Kbd;
