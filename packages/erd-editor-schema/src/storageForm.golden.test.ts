/// <reference types="vite/client" />
import { describe, expect, it } from 'vite-plus/test';

import { parser } from '@/parser';
import { toDocumentJson } from '@/storageForm';

// Each file is the storage form an earlier release wrote of a document that
// holds no logical name, domain or dictionary, read here as the bytes it holds.
const files = import.meta.glob<string>('./__fixtures__/storage-form/*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const names = Object.keys(files).map(path => path.split('/').pop()!);

describe('the storage form an earlier release wrote', () => {
  it('reads every saved fixture', () => {
    expect(names.sort()).toEqual([
      'custom-column-order.json',
      'data-test-v2.json',
      'json-schema-full.json',
      'legacy-tombstones.json',
      'new-document.json',
      'obsidian-legacy-v2.json',
      'unlocked-settings.json',
      'vscode-sample.json',
    ]);
  });

  it.each(Object.entries(files))('writes %s back byte for byte', (_, file) => {
    expect(toDocumentJson(parser(file))).toBe(file);
  });
});
