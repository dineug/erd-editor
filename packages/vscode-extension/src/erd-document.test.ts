import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

import { ErdDocument } from '@/erd-document';

import { resetVscodeMock, Uri, workspace } from '../test/mocks/vscode';

const encoder = new TextEncoder();

function createDocument(path = '/workspace/sample.erd', content = 'initial') {
  return ErdDocument.create(Uri.file(path) as any, encoder.encode(content));
}

describe('ErdDocument', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  it('exposes the uri and initial content it was created with', () => {
    const uri = Uri.file('/workspace/sample.erd');
    const content = encoder.encode('initial');
    const document = ErdDocument.create(uri as any, content);

    expect(document.uri).toBe(uri);
    expect(document.content).toBe(content);
  });

  describe('seedValue', () => {
    it('reads the bytes while no replica has saved a runtime value', () => {
      const document = createDocument('/workspace/sample.erd', '{"주문":1}');

      expect(document.runtimeValue).toBeUndefined();
      expect(document.seedValue()).toBe('{"주문":1}');
    });

    it('hands the runtime value once a replica saved one, whatever the bytes hold', async () => {
      const document = createDocument('/workspace/sample.erd', 'file form');
      document.runtimeValue = 'runtime value';
      await document.update(encoder.encode('saved form'));

      expect(document.seedValue()).toBe('runtime value');
    });
  });

  describe('save', () => {
    it('writes the current content back to its own uri', async () => {
      const document = createDocument();

      await document.save();

      expect(workspace.fs.writeFile).toHaveBeenCalledTimes(1);
      const [uri, content] = workspace.fs.writeFile.mock.calls[0];
      expect(uri).toBe(document.uri);
      expect(content).toBe(document.content);
    });

    it('writes to the destination for saveAs, leaving its own uri alone', async () => {
      const document = createDocument();
      const destination = Uri.file('/workspace/copy.erd');

      await document.saveAs(destination as any);

      expect(workspace.fs.writeFile).toHaveBeenCalledWith(
        destination,
        document.content
      );
      expect(document.uri.path).toBe('/workspace/sample.erd');
    });

    it('writes the bytes and never the runtime value, on save and save as alike', async () => {
      const document = createDocument('/workspace/sample.erd', 'file form');
      document.runtimeValue = 'runtime value';

      await document.save();
      await document.saveAs(Uri.file('/workspace/copy.erd') as any);

      const written = workspace.fs.writeFile.mock.calls.map(([, content]) =>
        new TextDecoder().decode(content)
      );
      expect(written).toEqual(['file form', 'file form']);
    });
  });

  describe('update', () => {
    it('replaces the content and fires onDidChangeContent', async () => {
      const document = createDocument();
      const listener = vi.fn();
      document.onDidChangeContent(listener);
      const next = encoder.encode('updated');

      await document.update(next);

      expect(document.content).toBe(next);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('stops notifying a listener once its subscription is disposed', async () => {
      const document = createDocument();
      const listener = vi.fn();
      const subscription = document.onDidChangeContent(listener);

      subscription.dispose();
      await document.update(encoder.encode('updated'));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('revert', () => {
    it('reloads the content from disk and discards in-memory edits', async () => {
      const document = createDocument();
      await document.update(encoder.encode('dirty'));
      const onDisk = encoder.encode('on-disk');
      workspace.fs.readFile.mockResolvedValue(onDisk);

      await document.revert();

      expect(workspace.fs.readFile).toHaveBeenCalledWith(document.uri);
      expect(document.content).toBe(onDisk);
    });

    it('leaves the runtime value, since the webview it came from is not reloaded', async () => {
      const document = createDocument();
      document.runtimeValue = 'what the webview holds';
      workspace.fs.readFile.mockResolvedValue(encoder.encode('on-disk'));

      await document.revert();

      expect(document.runtimeValue).toBe('what the webview holds');
      expect(document.seedValue()).toBe('what the webview holds');
    });

    it('does not fire onDidChangeContent — VSCode already knows it reverted', async () => {
      const document = createDocument();
      const listener = vi.fn();
      document.onDidChangeContent(listener);
      workspace.fs.readFile.mockResolvedValue(encoder.encode('on-disk'));

      await document.revert();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('backup', () => {
    it('writes the content to the backup destination and reports its id', async () => {
      const document = createDocument();
      const destination = Uri.file('/backups/sample.erd');

      const backup = await document.backup(destination as any);

      expect(workspace.fs.writeFile).toHaveBeenCalledWith(
        destination,
        document.content
      );
      expect(backup.id).toBe(destination.toString());
    });

    it('backs up the bytes, never the runtime value', async () => {
      const document = createDocument('/workspace/sample.erd', 'file form');
      document.runtimeValue = 'runtime value';

      await document.backup(Uri.file('/backups/sample.erd') as any);

      const [, content] = workspace.fs.writeFile.mock.calls[0];
      expect(new TextDecoder().decode(content)).toBe('file form');
    });

    it('round-trips its id back into a Uri, which is how the backup is reopened', async () => {
      const document = createDocument();
      const destination = Uri.file('/backups/sample.erd');

      const backup = await document.backup(destination as any);

      // ErdEditorProvider.openCustomDocument does exactly this with backupId.
      expect(Uri.parse(backup.id).path).toBe(destination.path);
      expect(Uri.parse(backup.id).scheme).toBe('file');
    });

    it('deletes the backup file when VSCode releases it', async () => {
      const document = createDocument();
      const destination = Uri.file('/backups/sample.erd');
      const backup = await document.backup(destination as any);

      await backup.delete();

      expect(workspace.fs.delete).toHaveBeenCalledWith(destination);
    });

    it('swallows a delete failure — a missing backup must not surface an error', async () => {
      const document = createDocument();
      const backup = await document.backup(
        Uri.file('/backups/gone.erd') as any
      );
      workspace.fs.delete.mockRejectedValue(new Error('ENOENT'));

      await expect(backup.delete()).resolves.toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('fires onDidDispose', () => {
      const document = createDocument();
      const listener = vi.fn();
      document.onDidDispose(listener);

      document.dispose();

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('tears down the content emitter so later updates notify nobody', async () => {
      const document = createDocument();
      const listener = vi.fn();
      document.onDidChangeContent(listener);

      document.dispose();
      await document.update(encoder.encode('after dispose'));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
