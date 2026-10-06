import { describe, expect, it } from 'vite-plus/test';

import { en } from '@/i18n/messages/en';

type Value = string | Readonly<Record<string, string>>;

/** Every part's English file, by the name its keys carry as their prefix. */
const parts = Object.entries(
  import.meta.glob<Record<string, Readonly<Record<string, Value>>>>(
    ['./*.ts', '!./index.ts', '!./*.test.ts'],
    { eager: true }
  )
).map(([path, module]) => {
  const name = path.replace(/^\.\/(.+)\.ts$/, '$1');
  return { name, module, messages: module[name] };
});

const entries = Object.entries(en as Readonly<Record<string, Value>>);

const textsOf = (value: Value) =>
  typeof value === 'string' ? [value] : Object.values(value);

describe('the English dictionary', () => {
  it('reads one file per part, each exporting its messages under its own name', () => {
    expect(parts.map(part => part.name).sort()).toEqual(
      [
        'code',
        'colorPicker',
        'common',
        'contextMenu',
        'exportImage',
        'feedback',
        'findReplace',
        'floatingToolbar',
        'palette',
        'settings',
        'shortcuts',
        'tableProperties',
        'themeBuilder',
        'toolbar',
        'visualization',
        'welcome',
      ].sort()
    );
    for (const part of parts) {
      expect(Object.keys(part.module), part.name).toEqual([part.name]);
    }
  });

  it('prefixes every key with the name of its file', () => {
    for (const { name, messages } of parts) {
      const strays = Object.keys(messages).filter(
        key => !key.startsWith(`${name}.`)
      );
      expect(strays, name).toEqual([]);
    }
  });

  it('holds every key of every file once, with the value its file gives it', () => {
    const total = parts.reduce(
      (sum, part) => sum + Object.keys(part.messages).length,
      0
    );

    expect(entries).toHaveLength(total);
    for (const { messages } of parts) {
      for (const [key, value] of Object.entries(messages)) {
        expect(Reflect.get(en, key), key).toBe(value);
      }
    }
  });

  it('has no empty or padded text and no brace but a placeholder', () => {
    for (const [key, value] of entries) {
      for (const text of textsOf(value)) {
        expect(text.trim(), key).toBe(text);
        expect(text.length, key).toBeGreaterThan(0);
        expect(text.replace(/\{\w+\}/g, ''), key).not.toMatch(/[{}]/);
      }
    }
  });

  it('writes a plural as one and other, each showing its count', () => {
    for (const [key, value] of entries) {
      if (typeof value === 'string') continue;

      expect(Object.keys(value).sort(), key).toEqual(['one', 'other']);
      for (const text of Object.values(value)) {
        expect(text, key).toContain('{count}');
      }
    }
  });

  it('keeps the shared words as the editor has always written them', () => {
    expect(en['common.close']).toBe('Close');
    expect(en['common.codeLanguage']).toBe('Language');
    expect(en['common.placement.treeVertical']).toBe('Tree - vertical');
    expect(en['common.toast.copied']).toBe('Copied!');
  });
});
