import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { convertSource } from '@/utils/convertSource';

// The real element needs a browser, where e2e runs it; this pins the calls.
vi.mock('@dineug/erd-editor', () => ({}));

const PLACED = '{"version":"3.0.0","placed":true}';

/**
 * An element whose import lands when the test says so, as a placement does
 * once the layout comes back: until then its value is the empty document.
 */
function stubEditor() {
  let land = () => {};
  let fail: (error: Error) => void = () => {};
  const placing = () =>
    new Promise<void>((resolve, reject) => {
      land = () => {
        editor.value = PLACED;
        resolve();
      };
      fail = reject;
    });
  const editor = {
    value: '{"version":"3.0.0"}',
    destroy: vi.fn(),
    setSchemaSQL: vi.fn(placing),
    setSchemaDBML: vi.fn(placing),
    setSchemaAML: vi.fn(placing),
    setSchemaGraphQL: vi.fn(placing),
    land: () => land(),
    fail: (error: Error) => fail(error),
  };
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
  ] as const)(
    'places %s with %s and gives the value back once it lands',
    async (type, method) => {
      const editor = stubEditor();

      const converting = convertSource({ type, value: 'source' });
      editor.land();

      await expect(converting).resolves.toBe(PLACED);
      expect(document.createElement).toHaveBeenCalledWith('erd-editor');
      expect(editor[method]).toHaveBeenCalledWith('source', {
        placement: 'auto',
      });
      expect(editor.destroy).toHaveBeenCalledTimes(1);
    }
  );

  it('keeps the element until the placement settles', async () => {
    const editor = stubEditor();

    const converting = convertSource({ type: 'sql', value: 'source' });
    await new Promise(resolve => setTimeout(resolve));

    expect(editor.destroy).not.toHaveBeenCalled();
    editor.land();
    await converting;
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the element when the placement rejects', async () => {
    const editor = stubEditor();

    const converting = convertSource({ type: 'dbml', value: 'source' });
    editor.fail(new Error('unplaceable'));

    await expect(converting).rejects.toThrow('unplaceable');
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });

  it('destroys the element when parsing throws', async () => {
    const editor = stubEditor();
    editor.setSchemaSQL.mockImplementation(() => {
      throw new Error('unreadable');
    });

    await expect(
      convertSource({ type: 'sql', value: 'source' })
    ).rejects.toThrow('unreadable');
    expect(editor.destroy).toHaveBeenCalledTimes(1);
  });
});
