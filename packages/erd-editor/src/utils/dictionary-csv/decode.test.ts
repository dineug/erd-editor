// @vitest-environment node

import { describe, expect, it } from 'vite-plus/test';

import { decodeCsvBytes, readDictionaryCsv } from '@/utils/dictionary-csv';

const encoder = new TextEncoder();

const fromHex = (hex: string) =>
  Uint8Array.from(hex.match(/../g) ?? [], byte => parseInt(byte, 16));

const EUC_KR_TEXT = '공통표준단어명,공통표준단어영문약어명\r\n고객,CUST\r\n';

/** The text above encoded as EUC-KR, which a public-standard file may come in. */
const EUC_KR_BYTES = fromHex(
  'b0f8c5ebc7a5c1d8b4dcbeeeb8ed2cb0f8c5ebc7a5c1d8b4dcbeeebfb5b9aebee0beeeb8ed0d0ab0edb0b42c435553540d0a'
);

describe('decodeCsvBytes', () => {
  it('reads UTF-8 and drops its byte order mark', () => {
    expect(decodeCsvBytes(encoder.encode('\uFEFF고객,CUST\r\n'))).toBe(
      '고객,CUST\r\n'
    );
    expect(decodeCsvBytes(encoder.encode('고객,CUST'))).toBe('고객,CUST');
  });

  it('takes the ArrayBuffer a file hands over', () => {
    expect(decodeCsvBytes(encoder.encode('name').buffer)).toBe('name');
  });

  it('reads bytes that are no valid UTF-8 as EUC-KR', () => {
    expect(() =>
      new TextDecoder('utf-8', { fatal: true }).decode(EUC_KR_BYTES)
    ).toThrow(TypeError);
    expect(new TextDecoder('euc-kr').decode(EUC_KR_BYTES)).toBe(EUC_KR_TEXT);

    expect(decodeCsvBytes(EUC_KR_BYTES)).toBe(EUC_KR_TEXT);
    expect(readDictionaryCsv(decodeCsvBytes(EUC_KR_BYTES))).toEqual({
      kind: 'word',
      format: 'publicStandard',
      fields: ['name', 'abbreviation'],
      rows: [{ name: '고객', abbreviation: 'CUST' }],
      skipped: 0,
    });
  });

  it('leaves bytes neither encoding reads as replacement characters, which no header matches', () => {
    const text = decodeCsvBytes(Uint8Array.of(0xff, 0xfe, 0x41));

    expect(text).toContain('�');
    expect(readDictionaryCsv(text)).toBeNull();
  });
});
