import { FC } from '@dineug/r-html';

import { shortcutToTuple } from '@/utils/keyboard-shortcut';

import * as styles from './Kbd.styles';

export type KbdProps = {
  shortcut?: string;
  mini?: boolean;
};

const Kbd: FC<KbdProps> = (props, ctx) => {
  return () => {
    const keys = shortcutToTuple(props.shortcut);
    const shortcuts = keys.map(([mods, key]) => [...mods, key].join(' + '));

    return (
      <div class={['kbd', styles.root]}>
        {shortcuts.map(shortcut => (
          <div class={props.mini ? styles.mini : styles.kbd}>{shortcut}</div>
        ))}
      </div>
    );
  };
};

export default Kbd;
