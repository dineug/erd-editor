import { describe, expect, it } from 'vite-plus/test';

import { RefPos, SortType } from '@/parser/statement';
import { indexColumnsParser } from '@/parser/statement/index.columns';
import { tokenizer } from '@/parser/tokenizer';

const parse = (source: string) => {
  const tokens = tokenizer(source);
  const $pos: RefPos = { value: 0 };
  const columns = indexColumnsParser(tokens, $pos);
  return { columns, $pos, tokens };
};

describe('indexColumnsParser', () => {
  it('reads each column with its sort and leaves the cursor past the list', () => {
    const { columns, $pos, tokens } = parse('(a, b DESC, c ASC) VISIBLE');

    expect(columns).toEqual([
      { name: 'a', sort: SortType.asc },
      { name: 'b', sort: SortType.desc },
      { name: 'c', sort: SortType.asc },
    ]);
    expect(tokens[$pos.value].value).toBe('VISIBLE');
  });

  it('keeps the column of a key part with a prefix length', () => {
    const { columns, $pos, tokens } = parse('(email(191) ASC, b), z');

    expect(columns).toEqual([
      { name: 'email', sort: SortType.asc },
      { name: 'b', sort: SortType.asc },
    ]);
    expect(tokens[$pos.value].value).toBe(',');
  });

  it('names each column by its first word, past a collation, an operator class and a null order', () => {
    const { columns, $pos, tokens } = parse(
      '(a COLLATE "C" DESC, b text_pattern_ops, c DESC NULLS LAST, d NULLS FIRST), z'
    );

    expect(columns).toEqual([
      { name: 'a', sort: SortType.desc },
      { name: 'b', sort: SortType.asc },
      { name: 'c', sort: SortType.desc },
      { name: 'd', sort: SortType.asc },
    ]);
    expect(tokens[$pos.value].value).toBe(',');
  });

  it('records no column for a key with an expression part', () => {
    const { columns, $pos, tokens } = parse('(id, (lower(email))), z');

    expect(columns).toEqual([]);
    expect(tokens[$pos.value].value).toBe(',');
  });

  it('reads no column from a list still open at the terminator, and stops there', () => {
    for (const source of [
      '(a, b(10); CREATE TABLE u (id INT);',
      '(a, lower(b; CREATE TABLE u (id INT);',
    ]) {
      const { columns, $pos, tokens } = parse(source);

      expect(columns).toEqual([]);
      expect(tokens[$pos.value].value).toBe(';');
    }
  });

  it('keeps what it read of an unterminated list', () => {
    const { columns, $pos, tokens } = parse('(a, b');

    expect(columns.map(column => column.name)).toEqual(['a', 'b']);
    expect($pos.value).toBeGreaterThan(tokens.length - 1);
  });
});
