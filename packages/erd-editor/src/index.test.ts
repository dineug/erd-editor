import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { createTestAppContext } from '@/__test-utils__/index';
import * as index from '@/index';
import { getShikiService } from '@/services/shikiService';
import { exportJSON } from '@/utils/file/exportFile';
import { importJSON } from '@/utils/file/importFile';

afterEach(() => {
  index.setExportFileCallback(null);
  index.setImportFileCallback(null);
  index.setGetShikiServiceCallback(() => null);
});

describe('@dineug/erd-editor entry point', () => {
  it('exposes exactly the documented public surface', () => {
    expect(Object.keys(index).sort()).toEqual([
      'setExportFileCallback',
      'setGetShikiServiceCallback',
      'setImportFileCallback',
    ]);
  });

  it('registers the <erd-editor> custom element as a side effect', () => {
    expect(customElements.get('erd-editor')).toBeTypeOf('function');
  });

  it('creates an element that implements the editor API', () => {
    const editor = document.createElement('erd-editor');

    expect(editor).toBeInstanceOf(customElements.get('erd-editor') as any);
    expect(editor.focus).toBeTypeOf('function');
    expect(editor.blur).toBeTypeOf('function');
    expect(editor.clear).toBeTypeOf('function');
    expect(editor.destroy).toBeTypeOf('function');
    expect(editor.setInitialValue).toBeTypeOf('function');
    expect(editor.setKeyBindingMap).toBeTypeOf('function');
  });

  it('re-exports setExportFileCallback so exports can be intercepted', () => {
    const performExport = vi.fn();
    index.setExportFileCallback(performExport);

    exportJSON('{"version":"3.0.0"}', 'my-schema');

    expect(performExport).toHaveBeenCalledTimes(1);
    const [blob, options] = performExport.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(options.fileName).toMatch(/^my-schema-.+\.erd\.json$/);
  });

  it('re-exports setImportFileCallback so imports can be intercepted', () => {
    const performImport = vi.fn();
    index.setImportFileCallback(performImport);

    importJSON(createTestAppContext());

    expect(performImport).toHaveBeenCalledWith({
      type: 'json',
      op: 'set',
      accept: '.json',
    });
  });

  it('re-exports setGetShikiServiceCallback so highlighting can be provided', () => {
    const service = { codeToHtml: async () => '<pre></pre>' };
    index.setGetShikiServiceCallback(() => service);

    expect(getShikiService()).toBe(service);
  });
});
