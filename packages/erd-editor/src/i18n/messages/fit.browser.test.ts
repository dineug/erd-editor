// Every language's text where the editor gives it a fixed width, measured as
// the editor measures it, in the font the stack resolves to on a Mac.

import { describe, expect, it } from 'vite-plus/test';
import { server } from 'vite-plus/test/browser/context';

import {
  COLUMN_MIN_WIDTH,
  TOOLBAR_DATABASE_NAME_WIDTH,
} from '@/constants/layout';
import { LocaleCodeList } from '@/i18n/locales';
import { en } from '@/i18n/messages/en';
import { messagesOf } from '@/i18n/messages/index';
import type { PlainMessageKey } from '@/i18n/translate';
import { TextFontFamily } from '@/styles/fonts.styles';
import { createText } from '@/utils/text';

/** The placeholders an empty cell shows, in a column no wider than COLUMN_MIN_WIDTH, picked by prefix as messages.test.ts picks them. */
const PLACEHOLDERS = Object.keys(en).filter(key =>
  key.startsWith('common.placeholder.')
) as PlainMessageKey[];

// Gated on the Vitest server's process.platform, since Linux and Windows set
// the stack in other fonts the bounds were not fitted to; messages.test.ts's
// 12-code-point cap on a placeholder is the form every platform runs.
const ON_MAC = server.platform === 'darwin';

describe('text the editor gives a fixed width', () => {
  it('measures every placeholder there is', () => {
    expect(PLACEHOLDERS).toEqual([
      'common.placeholder.table',
      'common.placeholder.column',
      'common.placeholder.comment',
      'common.placeholder.default',
      'common.placeholder.dataType',
    ]);
  });

  it.runIf(ON_MAC).each(LocaleCodeList)(
    '%s: each placeholder is no wider than an empty column, as a value is measured',
    code => {
      const { toWidth } = createText();
      const messages = messagesOf(code);
      const wide = PLACEHOLDERS.map(key => [
        key,
        toWidth(messages[key]),
      ]).filter(([, width]) => Number(width) > COLUMN_MIN_WIDTH);

      expect(wide).toEqual([]);
    }
  );

  it.runIf(ON_MAC).each(LocaleCodeList)(
    "%s: the database name placeholder fits the toolbar's input",
    code => {
      const input = document.createElement('input');
      input.style.fontFamily = TextFontFamily;
      document.body.append(input);
      const context = document.createElement('canvas').getContext('2d')!;
      context.font = getComputedStyle(input).font;
      input.remove();

      const { width } = context.measureText(
        messagesOf(code)['toolbar.databaseName']
      );
      expect(width).toBeLessThanOrEqual(TOOLBAR_DATABASE_NAME_WIDTH);
    }
  );
});
