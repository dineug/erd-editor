// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterAll, describe, expect, it } from 'vite-plus/test';

import { SOURCE_ROOT, walk } from '@/__test-utils__/importGraph';

/** The entries a Node peer or a replica loads, which carry no editor text. */
const DOM_FREE_ENTRIES = ['peer/index.ts', 'engine/index.ts'];

/** The workers built on their own, which are handed the dictionary they need. */
const WORKER_ENTRIES = [
  'services/export-png/exportPng.shared-worker.ts',
  'services/elk-layout/elkLayout.shared-worker.ts',
  'services/shiki/shiki.shared-worker.ts',
];

const isLocaleModule = (file: string) =>
  file.startsWith('i18n/') ||
  file === 'components/localeContext.ts' ||
  file.startsWith('components/localized/');

/** What a worker may reach of i18n: the runtime and English, never every language. */
const isWorkerSafe = (file: string) =>
  [
    'i18n/translate.ts',
    'i18n/locales.ts',
    'i18n/source.ts',
    'i18n/menuLabel.ts',
  ].includes(file) || file.startsWith('i18n/messages/en/');

const localeModulesOf = (entry: string, sourceRoot = SOURCE_ROOT) =>
  walk(join(sourceRoot, entry), sourceRoot).files.filter(isLocaleModule);

describe('the editor text stays out of the DOM-free entries', () => {
  it.each(DOM_FREE_ENTRIES)('%s reaches no i18n module', entry => {
    expect(localeModulesOf(entry)).toEqual([]);
  });
});

describe('a worker reaches no dictionary but English', () => {
  it.each(WORKER_ENTRIES)('%s', entry => {
    const reached = localeModulesOf(entry).filter(
      file => file.startsWith('i18n/') && !isWorkerSafe(file)
    );

    expect(reached).toEqual([]);
  });

  it('allows the runtime and the English files and nothing else of i18n', () => {
    expect(isWorkerSafe('i18n/translate.ts')).toBe(true);
    expect(isWorkerSafe('i18n/messages/en/common.ts')).toBe(true);
    expect(isWorkerSafe('i18n/messages/index.ts')).toBe(false);
    expect(isWorkerSafe('i18n/messages/ko-KR.ts')).toBe(false);
    expect(isWorkerSafe('i18n/resolveLocale.ts')).toBe(false);
  });
});

describe('the walk on a fixture', () => {
  const root = mkdtempSync(join(tmpdir(), 'erd-i18n-imports-'));

  const write = (path: string, source: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  };

  write('i18n/locales.ts', "export const SYSTEM_LOCALE = 'system';\n");
  write('components/localeContext.ts', 'export const localeContext = 1;\n');

  afterAll(() => rmSync(root, { recursive: true, force: true }));

  it('counts a type keyword inside the braces as a value import, which reaches the module', () => {
    write(
      'peer/index.ts',
      "import { type LocaleOption } from '@/i18n/locales';\nexport type { LocaleOption };\n"
    );

    expect(localeModulesOf('peer/index.ts', root)).toEqual(['i18n/locales.ts']);
  });

  it('skips an import type statement, which a bundler drops', () => {
    write(
      'engine/index.ts',
      "import type { LocaleOption } from '@/i18n/locales';\nexport type { LocaleOption };\n"
    );

    expect(localeModulesOf('engine/index.ts', root)).toEqual([]);
  });

  it('reports the locale context a relative import reaches', () => {
    write(
      'services/worker.ts',
      "import { localeContext } from '../components/localeContext';\nexport { localeContext };\n"
    );

    expect(localeModulesOf('services/worker.ts', root)).toEqual([
      'components/localeContext.ts',
    ]);
  });
});
