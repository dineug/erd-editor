// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import { parseCsv, serializeCsv } from '@/utils/dictionary-csv';

describe('parseCsv', () => {
  it('ends a record at CRLF, LF or CR, and reads a last one with no break', () => {
    expect(parseCsv('a,b\r\nc,d\ne,f\rg,h')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
      ['g', 'h'],
    ]);
  });

  it('keeps commas, line breaks and doubled quotes inside a quoted field', () => {
    expect(parseCsv('"a,b","two\r\nlines","say ""hi""","",plain\r\n')).toEqual([
      ['a,b', 'two\r\nlines', 'say "hi"', '', 'plain'],
    ]);
  });

  it('keeps empty fields, a trailing one included', () => {
    expect(parseCsv(',a,,\r\nb,')).toEqual([
      ['', 'a', '', ''],
      ['b', ''],
    ]);
  });

  it('reads no record from a blank line, a final line break or empty text', () => {
    expect(parseCsv('a\r\n\r\n\nb\r\n')).toEqual([['a'], ['b']]);
    expect(parseCsv('')).toEqual([]);
    expect(parseCsv('\uFEFF')).toEqual([]);
  });

  it('drops a leading byte order mark', () => {
    expect(parseCsv('\uFEFFname,abbreviation\r\n')).toEqual([
      ['name', 'abbreviation'],
    ]);
  });

  it('keeps a stray quote as text, and an unclosed quote runs to the end', () => {
    expect(parseCsv('a"b,"c"d,"open\r\nend')).toEqual([
      ['a"b', 'cd', 'open\r\nend'],
    ]);
  });
});

describe('serializeCsv', () => {
  it('opens with a byte order mark and ends every record with CRLF', () => {
    expect(
      serializeCsv([
        ['a', 'b'],
        ['c', 'd'],
      ])
    ).toBe('\uFEFFa,b\r\nc,d\r\n');
  });

  it('quotes only a field holding a quote, a comma or a line break', () => {
    expect(
      serializeCsv([
        ['plain', 'a,b', 'say "hi"', 'two\nlines', 'cr\rend', ' spaced ', ''],
      ])
    ).toBe(
      '\uFEFFplain,"a,b","say ""hi""","two\nlines","cr\rend", spaced ,\r\n'
    );
  });

  it('writes what parseCsv reads back as it was', () => {
    const records = [
      ['이름', '설명', '비고'],
      ['고객', '상품을 사는 사람, 또는 "조직"\r\n둘째 줄', ''],
      ['', '', ''],
    ];

    expect(parseCsv(serializeCsv(records))).toEqual(records);
  });
});
