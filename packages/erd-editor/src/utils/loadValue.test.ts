import { parser } from '@dineug/erd-editor-schema';
import { describe, expect, it } from 'vite-plus/test';

import { SaveSettingType } from '@/constants/schema';
import { toLoadValue } from '@/utils/loadValue';

describe('toLoadValue', () => {
  it.each([[''], ['  \n '], [undefined], [null], [42]])(
    'spells %j out as a new document, both save switches off',
    value => {
      const document = parser(toLoadValue(value));

      expect(document.version).toBe('3.0.0');
      expect(document.doc.tableIds).toEqual([]);
      expect(document.settings.ignoreSaveSettings).toBe(
        SaveSettingType.scroll | SaveSettingType.zoomLevel
      );
    }
  );

  it('hands a file over trimmed and otherwise as it is', () => {
    const file = '{"version":"3.0.0"}';

    expect(toLoadValue(`\n${file}  `)).toBe(file);
    expect(parser(toLoadValue(file)).settings.ignoreSaveSettings).toBe(0);
  });
});
