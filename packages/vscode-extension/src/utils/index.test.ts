import { describe, expect, it } from 'vitest';

import { textDecoder, textEncoder } from '@/utils';

describe('textEncoder / textDecoder', () => {
  it('decodes as utf-8 with the forgiving defaults', () => {
    // `TextEncoder` is utf-8 by specification and accepts no options, so the
    // decoder is the only half whose construction is an actual choice.
    expect(textDecoder.encoding).toBe('utf-8');
    expect(textDecoder.fatal).toBe(false);
    expect(textDecoder.ignoreBOM).toBe(false);
  });

  it('round-trips a multi-byte document payload — the pairing `erd-editor.ts` relies on between disk bytes and the webview value', () => {
    const document = JSON.stringify({
      settings: { databaseName: '주문 DB 🗂' },
      tables: [{ name: '회원', comment: 'members — 회원 정보' }],
    });

    const decoded = textDecoder.decode(textEncoder.encode(document));

    expect(decoded).toBe(document);
    expect(JSON.parse(decoded).tables[0].name).toBe('회원');
  });

  it('decodes an empty buffer to an empty string — a freshly created .erd file has no bytes', () => {
    expect(textDecoder.decode(new Uint8Array())).toBe('');
  });

  it('replaces invalid bytes instead of throwing, so a corrupted .erd still opens', () => {
    // 0xff is not a legal utf-8 lead byte. `fatal` is false, so it decodes to
    // U+FFFD; with `fatal: true` this would throw and reject
    // `bootstrapWebview`, failing the editor open outright.
    const corrupted = new Uint8Array([0x7b, 0xff, 0x7d]);

    expect(textDecoder.decode(corrupted)).toBe('{\ufffd}');
  });

  it('strips a leading UTF-8 BOM, so a BOM-prefixed file still parses as JSON', () => {
    const withBom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...textEncoder.encode('{}'),
    ]);

    expect(textDecoder.decode(withBom)).toBe('{}');
  });

  it('never writes a BOM back, so a BOM-prefixed file loses it on the first save', () => {
    // Characterises current behaviour, not desired behaviour: `ignoreBOM` is
    // false on the way in and `TextEncoder` cannot emit a BOM on the way out,
    // so the decode/encode round trip in `erd-editor.ts` drops it silently.
    const withBom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...textEncoder.encode('{}'),
    ]);

    const reEncoded = textEncoder.encode(textDecoder.decode(withBom));

    expect(Array.from(reEncoded)).toEqual([0x7b, 0x7d]);
  });
});
