import { describe, expect, it } from 'vite-plus/test';

import { formatDropWarning } from '@/components/schema-sql/schema-sql-options/dropWarning';
import { Database } from '@/constants/schema';
import { messagesOf } from '@/i18n/messages/index';
import { sourceI18n } from '@/i18n/source';
import { createI18n } from '@/i18n/translate';

const tables = (count: number) =>
  Array.from({ length: count }, (_, index) => `t${index + 1}`);

describe('formatDropWarning', () => {
  it('warns of nothing with no table to drop', () => {
    expect(formatDropWarning(sourceI18n, Database.MySQL, [])).toBeNull();
  });

  it('names one, two and five tables in full, joined as the language joins a list', () => {
    expect(formatDropWarning(sourceI18n, Database.MySQL, ['member'])).toBe(
      'Drops member before creating them. Their rows are lost.'
    );
    expect(
      formatDropWarning(sourceI18n, Database.PostgreSQL, ['member', 'post'])
    ).toBe('Drops member and post before creating them. Their rows are lost.');
    expect(formatDropWarning(sourceI18n, Database.MySQL, tables(5))).toBe(
      'Drops t1, t2, t3, t4, and t5 before creating them. Their rows are lost.'
    );
  });

  it('names the first four of six and counts the rest', () => {
    expect(formatDropWarning(sourceI18n, Database.MySQL, tables(6))).toBe(
      'Drops t1, t2, t3, t4, and 2 more tables before creating them. Their rows are lost.'
    );
    expect(
      formatDropWarning(sourceI18n, Database.MySQL, tables(5).concat('x'))
    ).toContain('2 more tables');
  });

  it('says Snowflake replaces the tables in place', () => {
    expect(
      formatDropWarning(sourceI18n, Database.Snowflake, ['member', 'post'])
    ).toBe('Replaces member and post. Their rows are lost.');
  });

  it("joins and counts in the reader's language", () => {
    const ko = createI18n('ko-KR', messagesOf('ko-KR'));

    expect(formatDropWarning(ko, Database.MySQL, tables(6))).toBe(
      '다음을 삭제한 뒤 다시 만듭니다: t1, t2, t3, t4 및 테이블 2개 더. 행이 사라집니다.'
    );
  });

  it('isolates each name in a right-to-left language, so the list runs as the sentence does', () => {
    const he = createI18n('he-IL', messagesOf('he-IL'));
    const ar = createI18n('ar-SA', messagesOf('ar-SA'));

    expect(formatDropWarning(he, Database.MySQL, ['member', 'post'])).toBe(
      'מוחק את \u2068\u2068member\u2069 ו-\u2068post\u2069\u2069 לפני יצירתן. השורות שלהן אובדות.'
    );
    expect(formatDropWarning(ar, Database.MySQL, tables(6))).toBe(
      'يحذف \u2068\u2068t1\u2069 و\u2068t2\u2069 و\u2068t3\u2069 و\u2068t4\u2069 و\u20682\u2069 جدولين آخرين\u2069 قبل إنشائها. تُفقد صفوفها.'
    );
  });

  it('counts the rest as what the sentence drops, in each case a language marks', () => {
    const counted = (locale: 'ru-RU' | 'uk-UA' | 'sl-SI', count: number) =>
      formatDropWarning(
        createI18n(locale, messagesOf(locale)),
        Database.MySQL,
        tables(count)
      );

    expect(counted('ru-RU', 25)).toContain('и ещё 21 таблицу перед');
    expect(counted('uk-UA', 25)).toContain('і ще 21 таблицю перед');
    expect(counted('sl-SI', 105)).toContain('in še 101 tabelo.');
  });
});
