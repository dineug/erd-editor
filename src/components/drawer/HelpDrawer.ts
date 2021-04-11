import {
  defineComponent,
  html,
  FunctionalComponent,
} from '@dineug/lit-observable';
import { useContext } from '@/core/hooks/context.hook';
import { keymapOptionsToString } from '@/core/keymap';

declare global {
  interface HTMLElementTagNameMap {
    'vuerd-help-drawer': HelpDrawerElement;
  }
}

export interface HelpDrawerProps {
  width: number;
  visible: boolean;
}

export interface HelpDrawerElement extends HelpDrawerProps, HTMLElement {}

interface HelpDescribe {
  name: string;
  keymap: string;
}

const HelpDrawer: FunctionalComponent<HelpDrawerProps, HelpDrawerElement> = (
  props,
  ctx
) => {
  const contextRef = useContext(ctx);

  const getHelpDescribe = (): HelpDescribe[] => {
    const { keymap } = contextRef.value;
    return [
      {
        name: 'Editing - ERD',
        keymap: `dblclick, ${keymapOptionsToString(keymap.edit)}`,
      },
      {
        name: 'Editing - Grid',
        keymap: 'dblclick, Enter',
      },
      {
        name: 'All Stop',
        keymap: keymapOptionsToString(keymap.stop),
      },
      {
        name: 'Search - find, filter',
        keymap: keymapOptionsToString(keymap.find),
      },
      {
        name: 'Undo - ERD',
        keymap: keymapOptionsToString(keymap.undo),
      },
      {
        name: 'Redo - ERD',
        keymap: keymapOptionsToString(keymap.redo),
      },
      {
        name: 'Selection - table, memo',
        keymap: `Ctrl + Drag, Click, Ctrl + Click, Cmd + Drag, Cmd + Click, ${keymapOptionsToString(
          keymap.selectAllTable
        )}`,
      },
      {
        name: 'Selection - column, filter',
        keymap: `Click, Ctrl + Click, Cmd + Click, Shift + Click, Shift + Arrow key(up, down), ${keymapOptionsToString(
          keymap.selectAllColumn
        )}`,
      },
      {
        name: 'Movement - table, memo, column, filter',
        keymap: 'Drag, Ctrl + Drag, Cmd + Drag',
      },
      {
        name: 'Copy - column',
        keymap: keymapOptionsToString(keymap.copyColumn),
      },
      {
        name: 'Paste - column',
        keymap: keymapOptionsToString(keymap.pasteColumn),
      },
      {
        name: 'Contextmenu - ERD, Table, Relationship, SQL DDL, Generator Code',
        keymap: 'Right-click',
      },
      {
        name: 'Table Properties',
        keymap: keymapOptionsToString(keymap.tableProperties),
      },
      {
        name: 'New Table',
        keymap: keymapOptionsToString(keymap.addTable),
      },
      {
        name: 'New Memo',
        keymap: keymapOptionsToString(keymap.addMemo),
      },
      {
        name: 'New - column, filter',
        keymap: keymapOptionsToString(keymap.addColumn),
      },
      {
        name: 'Delete - table, memo',
        keymap: keymapOptionsToString(keymap.removeTable),
      },
      {
        name: 'Delete - column, filter',
        keymap: keymapOptionsToString(keymap.removeColumn),
      },
      {
        name: 'Select Hint - dataType, find',
        keymap: 'Arrow key(right), Click',
      },
      {
        name: 'Move Hint - dataType, find',
        keymap: 'Arrow key(up, down)',
      },
      {
        name: 'Primary Key',
        keymap: keymapOptionsToString(keymap.primaryKey),
      },
      {
        name: 'checkbox - Grid, filter',
        keymap: 'Space, Click',
      },
      {
        name: 'Move checkbox - Grid, filter',
        keymap: 'Arrow key(up, down, left, right)',
      },
      {
        name: 'Relationship - Zero One N',
        keymap: keymapOptionsToString(keymap.relationshipZeroOneN),
      },
      {
        name: 'Relationship - Zero One',
        keymap: keymapOptionsToString(keymap.relationshipZeroOne),
      },
      {
        name: 'Relationship - Zero N',
        keymap: keymapOptionsToString(keymap.relationshipZeroN),
      },
      {
        name: 'Relationship - One Only',
        keymap: keymapOptionsToString(keymap.relationshipOneOnly),
      },
      {
        name: 'Relationship - One N',
        keymap: keymapOptionsToString(keymap.relationshipOneN),
      },
      {
        name: 'Relationship - One',
        keymap: keymapOptionsToString(keymap.relationshipOne),
      },
      {
        name: 'Relationship - N',
        keymap: keymapOptionsToString(keymap.relationshipN),
      },
    ];
  };

  const onClose = () => ctx.dispatchEvent(new CustomEvent('close'));

  return () => html`
    <vuerd-drawer
      name="Help"
      .width=${props.width}
      .visible=${props.visible}
      @close=${onClose}
    >
      <table>
        <thead>
          <th>Name</th>
          <th>Keymap</th>
        </thead>
        <tbody>
          ${getHelpDescribe().map(
            describe => html`
              <tr>
                <td>${describe.name}</td>
                <td>${describe.keymap}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    </vuerd-drawer>
  `;
};

defineComponent('vuerd-help-drawer', {
  observedProps: ['width', 'visible'],
  shadow: false,
  render: HelpDrawer,
});
