/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

// Pages silently skips a rule of public/_headers it cannot parse, and neither
// dev server reads the file, so nothing else notices a broken rule.

const HEADERS_FILE = join(process.cwd(), 'public', '_headers');

const REFUSE_FRAMING = [
  "Content-Security-Policy: frame-ancestors 'none'",
  'X-Frame-Options: DENY',
];

const HEADER_LINE = /^[A-Za-z0-9-]+: \S/;

/**
 * The rules as Pages reads them: an unindented line opens a path, indented
 * Name: value lines follow it, and a line starting with # is a comment.
 */
function parseHeaders(text: string): Map<string, string[]> {
  const rules = new Map<string, string[]>();
  let current: string[] | null = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;

    if (!/^\s/.test(line)) {
      current = [];
      rules.set(line.trim(), current);
      continue;
    }

    const header = line.trim();
    if (!current) throw new Error(`A header before any path: ${header}`);
    if (!HEADER_LINE.test(header)) throw new Error(`Not a header: ${header}`);
    current.push(header);
  }

  return rules;
}

describe('public/_headers', () => {
  const rules = parseHeaders(readFileSync(HEADERS_FILE, 'utf8'));

  it.each(['/gdrive', '/gdrive/*'])('refuses every frame on %s', path => {
    expect(rules.get(path)).toEqual(REFUSE_FRAMING);
  });

  it('refuses framing nowhere else, so others may still embed /', () => {
    const framed = [...rules]
      .filter(([, headers]) =>
        headers.some(header =>
          /^(?:content-security-policy|x-frame-options):/i.test(header)
        )
      )
      .map(([path]) => path);

    expect(framed).toEqual(['/gdrive', '/gdrive/*']);
  });

  it('reads a header line that lost its indent as a path of its own', () => {
    const parsed = parseHeaders(
      ['/gdrive', "Content-Security-Policy: frame-ancestors 'none'"].join('\n')
    );

    expect(parsed.get('/gdrive')).toEqual([]);
  });

  it('refuses an indented line that is no header', () => {
    expect(() =>
      parseHeaders(['/gdrive', '  X-Frame-Options DENY'].join('\n'))
    ).toThrow('Not a header');
  });
});
