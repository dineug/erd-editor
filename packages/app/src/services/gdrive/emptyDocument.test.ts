import { createReplicationStore } from '@dineug/erd-editor/engine.js';
import { describe, expect, it, vi } from 'vite-plus/test';

import { createEmptyDocument } from '@/services/gdrive/emptyDocument';
import { toDriveFingerprint } from '@/utils/documentFingerprint';
import { isEditorDocument } from '@/utils/importFile';
import { toWidth } from '@/utils/text';

describe('createEmptyDocument', () => {
  it('is a document the editor opens, as a new file must be', () => {
    const json = JSON.parse(createEmptyDocument());

    expect(isEditorDocument(json)).toBe(true);
    expect(json.version).toBe('3.0.0');
    expect(json.doc.tableIds).toEqual([]);
  });

  it('opens with no edit to save', () => {
    const value = createEmptyDocument();
    const store = createReplicationStore({ toWidth });
    store.setInitialValue(value);
    const opened = store.value;
    store.destroy();

    expect(toDriveFingerprint(opened)).toBe(toDriveFingerprint(value));
  });

  it('destroys the replica it reads', async () => {
    const destroy = vi.fn();
    vi.resetModules();
    vi.doMock('@dineug/erd-editor/engine.js', () => ({
      createReplicationStore: () => ({ value: '{"version":"3.0.0"}', destroy }),
    }));
    try {
      const fresh = await import('@/services/gdrive/emptyDocument');

      expect(fresh.createEmptyDocument()).toBe('{"version":"3.0.0"}');
      expect(destroy).toHaveBeenCalledTimes(1);
    } finally {
      vi.doUnmock('@dineug/erd-editor/engine.js');
      vi.resetModules();
    }
  });
});
