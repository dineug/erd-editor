import { afterEach, describe, expect, it } from 'vite-plus/test';

import { iconNameOf } from '@/__test-utils__/icon';
import { mountAndFlush, Mounted } from '@/__test-utils__/index';
import { fieldIcon } from '@/components/find-replace/fieldIcon';
import { FindField } from '@/utils/find-replace';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

const drawn = async (field: FindField, size?: number) => {
  mounted?.unmount();
  mounted = await mountAndFlush(fieldIcon(field, size));
  return mounted.container;
};

describe('fieldIcon', () => {
  it('draws each kind of text a match is found in with its own icon', async () => {
    const expected: Array<[FindField, string]> = [
      [FindField.tableName, 'table-2'],
      [FindField.tableComment, 'message-square-text'],
      [FindField.columnName, 'columns-2'],
      [FindField.columnComment, 'message-square-text'],
      [FindField.memo, 'sticky-note'],
    ];

    for (const [field, name] of expected) {
      expect(iconNameOf(await drawn(field))).toBe(name);
    }
  });

  it('draws at 14px unless told another size', async () => {
    const width = async (size?: number) =>
      (await drawn(FindField.tableName, size)).querySelector('svg')?.style
        .width;

    expect(await width()).toBe('14px');
    expect(await width(16)).toBe('16px');
  });
});
