import { describe, expect, it } from 'vite-plus/test';

import {
  PALETTE_PREFIXES,
  PaletteScope,
  parsePaletteQuery,
  scopeLabel,
} from '@/components/quick-search/paletteQuery';

describe('parsePaletteQuery', () => {
  it('reads no scope from a keyword without a prefix, trimmed', () => {
    expect(parsePaletteQuery('  users ')).toEqual({
      scope: null,
      keyword: 'users',
      table: null,
    });
    expect(parsePaletteQuery('')).toEqual({
      scope: null,
      keyword: '',
      table: null,
    });
  });

  it.each([
    ['>', PaletteScope.commands],
    ['#', PaletteScope.tables],
    ['@', PaletteScope.columns],
    ['"', PaletteScope.text],
    ['?', PaletteScope.help],
  ])(
    'reads %s as the %s scope, with or without a space after it',
    (prefix, scope) => {
      expect(parsePaletteQuery(`${prefix}auto`)).toEqual({
        scope,
        keyword: 'auto',
        table: null,
      });
      expect(parsePaletteQuery(`${prefix} auto`)).toEqual(
        parsePaletteQuery(`${prefix}auto`)
      );
      expect(parsePaletteQuery(prefix)).toEqual({
        scope,
        keyword: '',
        table: null,
      });
    }
  );

  it('takes a prefix only as the first character', () => {
    expect(parsePaletteQuery(' >auto')).toEqual({
      scope: null,
      keyword: '>auto',
      table: null,
    });
    expect(parsePaletteQuery('auto>')).toMatchObject({ scope: null });
    expect(parsePaletteQuery('user@mail')).toMatchObject({ scope: null });
  });

  it('keeps a second prefix character in the keyword', () => {
    expect(parsePaletteQuery('##hash')).toEqual({
      scope: PaletteScope.tables,
      keyword: '#hash',
      table: null,
    });
    expect(parsePaletteQuery('">quoted')).toMatchObject({
      scope: PaletteScope.text,
      keyword: '>quoted',
    });
  });

  it('splits a column search on its first dot into a table part and a column part', () => {
    expect(parsePaletteQuery('@users.em')).toEqual({
      scope: PaletteScope.columns,
      keyword: 'em',
      table: 'users',
    });
    expect(parsePaletteQuery('@users.')).toEqual({
      scope: PaletteScope.columns,
      keyword: '',
      table: 'users',
    });
    expect(parsePaletteQuery('@em')).toEqual({
      scope: PaletteScope.columns,
      keyword: 'em',
      table: null,
    });
    expect(parsePaletteQuery('@ users . em.x ')).toEqual({
      scope: PaletteScope.columns,
      keyword: 'em.x',
      table: 'users',
    });
    expect(parsePaletteQuery('@.em')).toEqual({
      scope: PaletteScope.columns,
      keyword: 'em',
      table: '',
    });
  });

  it('keeps a dot in the keyword of every other scope', () => {
    expect(parsePaletteQuery('"users.id')).toMatchObject({
      keyword: 'users.id',
      table: null,
    });
    expect(parsePaletteQuery('#schema.users')).toMatchObject({
      keyword: 'schema.users',
      table: null,
    });
    expect(parsePaletteQuery('users.id')).toMatchObject({
      keyword: 'users.id',
      table: null,
    });
  });
});

describe('PALETTE_PREFIXES', () => {
  it('lists one distinct single character per scope, each with a label and a description', () => {
    expect(PALETTE_PREFIXES.map(({ prefix }) => prefix)).toEqual([
      '>',
      '#',
      '@',
      '"',
      '?',
    ]);
    expect(new Set(PALETTE_PREFIXES.map(({ scope }) => scope)).size).toBe(
      Object.keys(PaletteScope).length
    );
    for (const { label, description } of PALETTE_PREFIXES) {
      expect(label).not.toBe('');
      expect(description).not.toBe('');
    }
  });

  it('names each scope for the label beside the input', () => {
    expect(scopeLabel(PaletteScope.commands)).toBe('Commands');
    expect(scopeLabel(PaletteScope.tables)).toBe('Tables');
    expect(scopeLabel(PaletteScope.columns)).toBe('Columns');
    expect(scopeLabel(PaletteScope.text)).toBe('Comments & memos');
    expect(scopeLabel(PaletteScope.help)).toBe('Help');
    expect(scopeLabel('unknown' as PaletteScope)).toBe('');
  });
});
