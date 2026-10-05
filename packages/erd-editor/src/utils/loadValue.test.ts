import { parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { toLoadValue } from '@/utils/loadValue';

describe('toLoadValue', () => {
  it.each([[''], ['  \n '], [undefined], [null], [42]])(
    'spells %j out as a new document, every lock on',
    value => {
      const document = parser(toLoadValue(value));

      expect(document.version).toBe('3.0.0');
      expect(document.doc.tableIds).toEqual([]);
      expect(document.settings.lockSettings).toBe(63);
    }
  );

  it('hands a file over trimmed and otherwise as it is', () => {
    const file = '{"version":"3.0.0","settings":{"lockSettings":0}}';

    expect(toLoadValue(`\n${file}  `)).toBe(file);
    expect(parser(toLoadValue(file)).settings.lockSettings).toBe(0);
  });
});
