/**
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
 * https://developer.mozilla.org/ko/docs/Web/API/KeyboardEvent/key/Key_Values
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
 * https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code/code_values
 */

import { Keymap, KeymapOption, MultipleKey } from '@type/core/keymap';

export function createKeymap(): Keymap {
  return {
    edit: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'Enter',
      },
    ],
    stop: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'Escape',
      },
    ],
    find: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'F',
      },
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: 'F',
      },
    ],
    undo: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'Z',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'Z',
      },
    ],
    redo: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: true,
        key: 'Z',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
        key: 'Z',
      },
    ],
    addTable: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'N',
      },
    ],
    addColumn: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'Enter',
      },
    ],
    addMemo: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'M',
      },
    ],
    removeTable: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'Delete',
      },
    ],
    removeColumn: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'Delete',
      },
    ],
    primaryKey: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'K',
      },
    ],
    selectAllTable: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: 'A',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'A',
      },
    ],
    selectAllColumn: [
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'A',
      },
    ],
    copyColumn: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'C',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'C',
      },
    ],
    pasteColumn: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'V',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
        key: 'V',
      },
    ],
    relationshipZeroOneN: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '1',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '1',
      },
    ],
    relationshipZeroOne: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '2',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '2',
      },
    ],
    relationshipZeroN: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '3',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '3',
      },
    ],
    relationshipOneOnly: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '4',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '4',
      },
    ],
    relationshipOneN: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '5',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '5',
      },
    ],
    relationshipOne: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '6',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '6',
      },
    ],
    relationshipN: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
        key: '7',
      },
      {
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: '7',
      },
    ],
    tableProperties: [
      {
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
        key: 'Space',
      },
      {
        metaKey: false,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
        key: 'Space',
      },
    ],
  };
}

const multipleKeys: MultipleKey[] = [
  'altKey',
  'metaKey',
  'ctrlKey',
  'shiftKey',
];

export function keymapMatch(
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
): boolean {
  let result = false;

  for (const keymapOption of keymapOptions) {
    const isMultipleKey = multipleKeys.every(
      multipleKey => keymapOption[multipleKey] === event[multipleKey]
    );

    result = keymapOption.key
      ? isMultipleKey &&
        (event.key.toUpperCase() === keymapOption.key.toUpperCase() ||
          event.code.toUpperCase() === keymapOption.key.toUpperCase() ||
          event.code.toUpperCase() === `Key${keymapOption.key}`.toUpperCase() ||
          event.code.toUpperCase() === `Digit${keymapOption.key}`.toUpperCase())
      : isMultipleKey;

    if (result) {
      break;
    }
  }

  return result;
}

export function getKeymapMatch(
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
): KeymapOption | null {
  let result = false;

  for (const keymapOption of keymapOptions) {
    const isMultipleKey = multipleKeys.every(
      multipleKey => keymapOption[multipleKey] === event[multipleKey]
    );

    result = keymapOption.key
      ? isMultipleKey &&
        (event.key.toUpperCase() === keymapOption.key.toUpperCase() ||
          event.code.toUpperCase() === keymapOption.key.toUpperCase() ||
          event.code.toUpperCase() === `Key${keymapOption.key}`.toUpperCase() ||
          event.code.toUpperCase() === `Digit${keymapOption.key}`.toUpperCase())
      : isMultipleKey;

    if (result) {
      return keymapOption;
    }
  }

  return null;
}

export function keymapOptionToString(keymapOption?: KeymapOption): string {
  if (!keymapOption) return '';

  const result: string[] = [];

  if (keymapOption.metaKey) {
    result.push('Cmd');
  }
  if (keymapOption.ctrlKey) {
    result.push('Ctrl');
  }
  if (keymapOption.altKey) {
    result.push('Alt');
  }
  if (keymapOption.shiftKey) {
    result.push('Shift');
  }
  if (keymapOption.key) {
    result.push(keymapOption.key);
  }

  return result.join(' + ');
}

export const keymapOptionsToString = (keymapOptions: KeymapOption[]) =>
  keymapOptions.map(option => keymapOptionToString(option)).join(', ');
