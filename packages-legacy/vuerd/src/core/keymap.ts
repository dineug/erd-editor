import { isArray } from '@/core/helper';
import {
  Keymap,
  KeymapKey,
  KeymapOption,
  MultipleKey,
} from '@@types/core/keymap';

export const createKeymap = (): Keymap => ({
  edit: [
    {
      key: 'Enter',
    },
  ],
  stop: [
    {
      key: 'Escape',
    },
  ],
  find: [
    {
      ctrlKey: true,
      key: 'F',
      preventDefault: true,
      stopPropagation: true,
    },
    {
      metaKey: true,
      key: 'F',
      preventDefault: true,
      stopPropagation: true,
    },
  ],
  undo: [
    {
      ctrlKey: true,
      key: 'Z',
      preventDefault: true,
    },
    {
      metaKey: true,
      key: 'Z',
      preventDefault: true,
    },
  ],
  redo: [
    {
      ctrlKey: true,
      shiftKey: true,
      key: 'Z',
      preventDefault: true,
    },
    {
      metaKey: true,
      shiftKey: true,
      key: 'Z',
      preventDefault: true,
    },
  ],
  addTable: [
    {
      altKey: true,
      key: 'N',
      preventDefault: true,
    },
  ],
  addColumn: [
    {
      altKey: true,
      key: 'Enter',
      preventDefault: true,
    },
  ],
  addMemo: [
    {
      altKey: true,
      key: 'M',
      preventDefault: true,
    },
  ],
  removeTable: [
    {
      ctrlKey: true,
      key: 'Delete',
      preventDefault: true,
    },
    {
      ctrlKey: true,
      key: 'Backspace',
      preventDefault: true,
    },
    {
      metaKey: true,
      key: 'Delete',
      preventDefault: true,
    },
    {
      metaKey: true,
      key: 'Backspace',
      preventDefault: true,
    },
  ],
  removeColumn: [
    {
      altKey: true,
      key: 'Delete',
      preventDefault: true,
    },
    {
      altKey: true,
      key: 'Backspace',
      preventDefault: true,
    },
  ],
  primaryKey: [
    {
      altKey: true,
      key: 'K',
      preventDefault: true,
    },
  ],
  selectAllTable: [
    {
      ctrlKey: true,
      altKey: true,
      key: 'A',
      preventDefault: true,
    },
    {
      metaKey: true,
      altKey: true,
      key: 'A',
      preventDefault: true,
    },
  ],
  selectAllColumn: [
    {
      altKey: true,
      key: 'A',
      preventDefault: true,
    },
  ],
  copyColumn: [
    {
      ctrlKey: true,
      key: 'C',
    },
    {
      metaKey: true,
      key: 'C',
    },
  ],
  pasteColumn: [
    {
      ctrlKey: true,
      key: 'V',
    },
    {
      metaKey: true,
      key: 'V',
    },
  ],
  relationshipZeroOne: [
    {
      ctrlKey: true,
      altKey: true,
      key: '1',
      preventDefault: true,
    },
    {
      metaKey: true,
      altKey: true,
      key: '1',
      preventDefault: true,
    },
  ],
  relationshipZeroN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '2',
      preventDefault: true,
    },
    {
      metaKey: true,
      altKey: true,
      key: '2',
      preventDefault: true,
    },
  ],
  relationshipOneOnly: [
    {
      ctrlKey: true,
      altKey: true,
      key: '3',
      preventDefault: true,
    },
    {
      metaKey: true,
      altKey: true,
      key: '3',
      preventDefault: true,
    },
  ],
  relationshipOneN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '4',
      preventDefault: true,
    },
    {
      metaKey: true,
      altKey: true,
      key: '4',
      preventDefault: true,
    },
  ],
  tableProperties: [
    {
      altKey: true,
      key: 'Space',
      preventDefault: true,
    },
    {
      ctrlKey: true,
      key: 'Space',
      preventDefault: true,
    },
  ],
  zoomIn: [
    {
      ctrlKey: true,
      key: 'Equal',
      preventDefault: true,
      stopPropagation: true,
    },
    {
      metaKey: true,
      key: 'Equal',
      preventDefault: true,
      stopPropagation: true,
    },
  ],
  zoomOut: [
    {
      ctrlKey: true,
      key: 'Minus',
      preventDefault: true,
      stopPropagation: true,
    },
    {
      metaKey: true,
      key: 'Minus',
      preventDefault: true,
      stopPropagation: true,
    },
  ],
});

const multipleKeys: MultipleKey[] = [
  'altKey',
  'metaKey',
  'ctrlKey',
  'shiftKey',
];

const keyEquals = (event: KeyboardEvent, key: string) =>
  event.key.toUpperCase() === key.toUpperCase() ||
  event.code.toUpperCase() === key.toUpperCase() ||
  event.code.toUpperCase() === `Key${key}`.toUpperCase() ||
  event.code.toUpperCase() === `Digit${key}`.toUpperCase();

export const getKeymap = (
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
) =>
  keymapOptions.find(keymapOption => {
    const isMultipleKey = multipleKeys.every(
      multipleKey => !!keymapOption[multipleKey] === event[multipleKey]
    );

    return keymapOption.key
      ? isMultipleKey && keyEquals(event, keymapOption.key)
      : isMultipleKey;
  });

export const keymapMatch = (
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
) => !!getKeymap(event, keymapOptions);

export function keymapMatchAndStop(
  event: KeyboardEvent,
  keymapOptions: KeymapOption[]
): boolean {
  const current = getKeymap(event, keymapOptions);

  current?.preventDefault && event.preventDefault();
  current?.stopPropagation && event.stopPropagation();

  return !!current;
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

export const loadKeymap = (keymap: Keymap, newKeymap: Partial<Keymap>) =>
  (Object.keys(keymap) as KeymapKey[])
    .filter(key => isArray(newKeymap[key]))
    .forEach(key => (keymap[key] = newKeymap[key] as KeymapOption[]));
