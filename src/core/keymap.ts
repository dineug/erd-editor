import {
  Keymap,
  KeymapOption,
  MultipleKey,
  KeymapKey,
} from '@@types/core/keymap';
import { isArray } from '@/core/helper';

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
      altKey: true,
      key: 'F',
      preventDefault: true,
    },
    {
      ctrlKey: true,
      altKey: true,
      key: 'F',
      preventDefault: true,
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
    },
  ],
  addColumn: [
    {
      altKey: true,
      key: 'Enter',
    },
  ],
  addMemo: [
    {
      altKey: true,
      key: 'M',
    },
  ],
  removeTable: [
    {
      ctrlKey: true,
      key: 'Delete',
    },
    {
      metaKey: true,
      key: 'Delete',
    },
  ],
  removeColumn: [
    {
      altKey: true,
      key: 'Delete',
    },
  ],
  primaryKey: [
    {
      altKey: true,
      key: 'K',
    },
  ],
  selectAllTable: [
    {
      ctrlKey: true,
      altKey: true,
      key: 'A',
    },
    {
      metaKey: true,
      altKey: true,
      key: 'A',
    },
  ],
  selectAllColumn: [
    {
      altKey: true,
      key: 'A',
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
  relationshipZeroOneN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '1',
    },
    {
      metaKey: true,
      altKey: true,
      key: '1',
    },
  ],
  relationshipZeroOne: [
    {
      ctrlKey: true,
      altKey: true,
      key: '2',
    },
    {
      metaKey: true,
      altKey: true,
      key: '2',
    },
  ],
  relationshipZeroN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '3',
    },
    {
      metaKey: true,
      altKey: true,
      key: '3',
    },
  ],
  relationshipOneOnly: [
    {
      ctrlKey: true,
      altKey: true,
      key: '4',
    },
    {
      metaKey: true,
      altKey: true,
      key: '4',
    },
  ],
  relationshipOneN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '5',
    },
    {
      metaKey: true,
      altKey: true,
      key: '5',
    },
  ],
  relationshipOne: [
    {
      ctrlKey: true,
      altKey: true,
      key: '6',
    },
    {
      metaKey: true,
      altKey: true,
      key: '6',
    },
  ],
  relationshipN: [
    {
      ctrlKey: true,
      altKey: true,
      key: '7',
    },
    {
      metaKey: true,
      altKey: true,
      key: '7',
    },
  ],
  tableProperties: [
    {
      ctrlKey: true,
      key: 'Space',
    },
    {
      altKey: true,
      key: 'Space',
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
