import { FC, html } from '@dineug/r-html';

import { useAppContext } from '@/components/appContext';
import Kbd from '@/components/primitives/kbd/Kbd';
import { ShortcutOption } from '@/utils/keyboard-shortcut';

import * as styles from './Shortcuts.styles';

export type ShortcutsProps = {};

type ShortcutItem = {
  command: string;
  shortcuts: ShortcutOption[];
};

const Shortcuts: FC<ShortcutsProps> = (props, ctx) => {
  const app = useAppContext(ctx);

  const getItems = (): ShortcutItem[] => {
    const { keyBindingMap } = app.value;

    return [
      {
        command: 'Editing',
        shortcuts: keyBindingMap.edit,
      },
      {
        command: 'Stop',
        shortcuts: keyBindingMap.stop,
      },
      {
        command: 'Search',
        shortcuts: keyBindingMap.find,
      },
      {
        command: 'Undo',
        shortcuts: keyBindingMap.undo,
      },
      {
        command: 'Redo',
        shortcuts: keyBindingMap.redo,
      },
      {
        command: 'Add Table',
        shortcuts: keyBindingMap.addTable,
      },
      {
        command: 'Add Column',
        shortcuts: keyBindingMap.addColumn,
      },
      {
        command: 'Add Memo',
        shortcuts: keyBindingMap.addMemo,
      },
      {
        command: 'Remove Table, Memo',
        shortcuts: keyBindingMap.removeTable,
      },
      {
        command: 'Remove Column',
        shortcuts: keyBindingMap.removeColumn,
      },
      {
        command: 'Primary Key',
        shortcuts: keyBindingMap.primaryKey,
      },
      {
        command: 'Select All Table, Memo',
        shortcuts: keyBindingMap.selectAllTable,
      },
      {
        command: 'Select All Column',
        shortcuts: keyBindingMap.selectAllColumn,
      },
      {
        command: 'Relationship Zero One',
        shortcuts: keyBindingMap.relationshipZeroOne,
      },
      {
        command: 'Relationship Zero N',
        shortcuts: keyBindingMap.relationshipZeroN,
      },
      {
        command: 'Relationship One Only',
        shortcuts: keyBindingMap.relationshipOneOnly,
      },
      {
        command: 'Relationship One N',
        shortcuts: keyBindingMap.relationshipOneN,
      },
      {
        command: 'Table Properties',
        shortcuts: keyBindingMap.tableProperties,
      },
      {
        command: 'Zoom In',
        shortcuts: keyBindingMap.zoomIn,
      },
      {
        command: 'Zoom Out',
        shortcuts: keyBindingMap.zoomOut,
      },
    ];
  };

  return () => {
    return html`
      <table class=${styles.table}>
        <thead>
          <tr>
            <th>Command</th>
            <th>Keybinding</th>
          </tr>
        </thead>
        <tbody>
          ${getItems().map(
            ({ command, shortcuts }) => html`
              <tr>
                <td>${command}</td>
                <td>
                  ${shortcuts.map(
                    ({ shortcut }) => html`
                      <div class=${styles.shortcutGroup}>
                        <${Kbd} shortcut=${shortcut} />
                      </div>
                    `
                  )}
                </td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  };
};

export default Shortcuts;
