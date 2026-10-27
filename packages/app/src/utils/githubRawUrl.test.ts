import { describe, expect, it } from 'vite-plus/test';

import { toGithubRawUrl } from './githubRawUrl';

const RAW_FILE = 'https://raw.githubusercontent.com/o/r/main/a.erd.json';
const RAW_GIST = 'https://gist.githubusercontent.com/u/abc123/raw';

const MAPPED: ReadonlyArray<readonly [string, string]> = [
  ['https://github.com/o/r/blob/main/a.erd.json', RAW_FILE],
  ['https://github.com/o/r/raw/main/a.erd.json', RAW_FILE],
  ['https://github.com/o/r/blob/main/a.erd.json?raw=true', RAW_FILE],
  ['https://github.com/o/r/blob/main/a.erd.json?plain=1', RAW_FILE],
  ['https://github.com/o/r/blob/main/a.erd.json#L3', RAW_FILE],
  ['https://github.com/o/r/blob/main/a.erd.json?foo=1#L3', RAW_FILE],
  ['https://github.com/o/r/raw/main/a.erd.json?foo=1#L3', RAW_FILE],
  ['HTTPS://GitHub.com/o/r/blob/main/a.erd.json', RAW_FILE],
  [' https://github.com/o/r/blob/main/a.erd.json\n', RAW_FILE],
  ['https://www.github.com/o/r/blob/main/a.erd.json', RAW_FILE],
  ['https://github.com:443/o/r/blob/main/a.erd.json', RAW_FILE],
  [
    'https://github.com/o/r/blob/main/my%20schema.erd.json',
    'https://raw.githubusercontent.com/o/r/main/my%20schema.erd.json',
  ],
  [
    'https://github.com/o/r/blob/main/my schema.erd.json',
    'https://raw.githubusercontent.com/o/r/main/my%20schema.erd.json',
  ],
  [
    'https://github.com/o/r/blob/feature/x/a/b.erd.json',
    'https://raw.githubusercontent.com/o/r/feature/x/a/b.erd.json',
  ],
  ['https://gist.github.com/u/abc123', RAW_GIST],
  ['https://gist.github.com/u/abc123/', RAW_GIST],
  ['https://gist.github.com/u/abc123#file-a-json', RAW_GIST],
  ['https://gist.github.com/u/abc123?x=1', RAW_GIST],
];

const KEPT: ReadonlyArray<string> = [
  RAW_FILE,
  RAW_GIST,
  'https://github.com/o/r/tree/main/docs',
  'https://github.com/o/r',
  'https://github.com/o/r/blob/main',
  'https://github.com/o/r/blob/',
  'https://github.com/o/r/blob/main/',
  'https://github.com//r/blob/main/a.erd.json',
  'https://github.com/o/r/BLOB/main/a.erd.json',
  'https://github.com:8443/o/r/blob/main/a.erd.json',
  'http://github.com/o/r/blob/main/a.erd.json',
  'https://github.example.com/o/r/blob/main/a.erd.json',
  'https://gist.github.com/u',
  'https://gist.github.com/abc123',
  'https://gist.github.com/u/abc123//',
  'https://gist.github.com/u/abc123/revisions',
  'http://gist.github.com/u/abc123',
  'https://example.com/a.erd.json',
  'diagram.erd.json',
  '/schemas/diagram.erd.json',
  'data:application/json,{}',
  '',
  'http://[',
];

describe('toGithubRawUrl', () => {
  it.each(MAPPED)('maps %j to %s', (input, raw) => {
    expect(toGithubRawUrl(input)).toBe(raw);
  });

  it.each(KEPT)('keeps %j as it came', input => {
    expect(toGithubRawUrl(input)).toBe(input);
  });

  it('changes nothing called again on its own answer', () => {
    for (const input of [...MAPPED.map(([input]) => input), ...KEPT]) {
      const once = toGithubRawUrl(input);
      expect(toGithubRawUrl(once)).toBe(once);
    }
  });
});
