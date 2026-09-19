import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { convertSource } from '@/utils/convertSource';

// The real element needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor', () => ({}));

function stubEditor(fail?: string) {
  const editor = {
    value: '{"version":"3.0.0"}',
    destroy: vi.fn(),
    setSchemaSQL: vi.fn(),
    setSchemaDBML: vi.fn(),
    setSchemaAML: vi.fn(),
    setSchemaGraphQL: vi.fn(),
  };
  if (fail) {
    Reflect.set(editor, fail, () => {
      throw new Error('unreadable');
    });
  }
  vi.spyOn(document, 'createElement').mockReturnValue(editor as any);
  return editor;
}

describe('convertSource', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['sql', 'setSchemaSQL'],
    ['dbml', 'setSchemaDBML'],
    ['aml', 'setSchemaAML'],
    ['graphql', 'setSchemaGraphQL'],
  ] as const)('parses %s with %s and gives the value back', (type, method) => {
    const editor = stubEditor();

    expect(convertSource({ type, value: 'source' })).toBe(editor.value);

    expect(document.createElement).toHaveBeenCalledWith('erd-editor');
    expect(editor[method]).toHaveBeenCalledWith('source');
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the element when parsing throws', () => {
    const editor = stubEditor('setSchemaSQL');

    expect(() => convertSource({ type: 'sql', value: 'source' })).toThrow(
      'unreadable'
    );
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });
});
