import { FC } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import { useI18n } from '@/components/localeContext';
import Kbd from '@/components/primitives/kbd/Kbd';
import type { PlainMessageKey } from '@/i18n/translate';
import { KeyBindingName } from '@/utils/keyboard-shortcut';

import * as styles from './Shortcuts.styles';

export type ShortcutsProps = {};

/** Each command's name as the key of its message, in the order the page lists them. */
const ShortcutNameKey = {
  [KeyBindingName.edit]: 'shortcuts.name.edit',
  [KeyBindingName.stop]: 'shortcuts.name.stop',
  [KeyBindingName.search]: 'shortcuts.name.search',
  [KeyBindingName.findReplace]: 'shortcuts.name.findReplace',
  [KeyBindingName.undo]: 'shortcuts.name.undo',
  [KeyBindingName.redo]: 'shortcuts.name.redo',
  [KeyBindingName.addTable]: 'shortcuts.name.addTable',
  [KeyBindingName.addColumn]: 'shortcuts.name.addColumn',
  [KeyBindingName.addMemo]: 'shortcuts.name.addMemo',
  [KeyBindingName.removeTable]: 'shortcuts.name.removeTable',
  [KeyBindingName.removeColumn]: 'shortcuts.name.removeColumn',
  [KeyBindingName.removeSelection]: 'shortcuts.name.removeSelection',
  [KeyBindingName.primaryKey]: 'shortcuts.name.primaryKey',
  [KeyBindingName.selectAllTable]: 'shortcuts.name.selectAllTable',
  [KeyBindingName.selectAllColumn]: 'shortcuts.name.selectAllColumn',
  [KeyBindingName.relationshipZeroOne]: 'shortcuts.name.relationshipZeroOne',
  [KeyBindingName.relationshipZeroN]: 'shortcuts.name.relationshipZeroN',
  [KeyBindingName.relationshipOneOnly]: 'shortcuts.name.relationshipOneOnly',
  [KeyBindingName.relationshipOneN]: 'shortcuts.name.relationshipOneN',
  [KeyBindingName.tableProperties]: 'shortcuts.name.tableProperties',
  [KeyBindingName.focusView]: 'shortcuts.name.focusView',
  [KeyBindingName.zoomIn]: 'shortcuts.name.zoomIn',
  [KeyBindingName.zoomOut]: 'shortcuts.name.zoomOut',
  [KeyBindingName.zoomReset]: 'shortcuts.name.zoomReset',
  [KeyBindingName.handTool]: 'shortcuts.name.handTool',
  [KeyBindingName.zenMode]: 'shortcuts.name.zenMode',
} as const satisfies Record<KeyBindingName, PlainMessageKey>;

const ShortcutNameList = Object.keys(ShortcutNameKey) as KeyBindingName[];

const Shortcuts: FC<ShortcutsProps> = (props, ctx) => {
  const app = useAppContext(ctx);
  const i18n = useI18n(ctx);

  return () => {
    const { keyBindingMap } = app.value;
    const { t } = i18n.value;

    return (
      <table class={styles.table}>
        <thead>
          <tr>
            <th>{t('shortcuts.command')}</th>
            <th>{t('shortcuts.keybinding')}</th>
          </tr>
        </thead>
        <tbody>
          {ShortcutNameList.map(name => (
            <tr>
              <td>{t(ShortcutNameKey[name])}</td>
              <td>
                {keyBindingMap[name].map(({ shortcut }) => (
                  <div class={styles.shortcutGroup}>
                    <Kbd shortcut={shortcut} />
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };
};

export default Shortcuts;
