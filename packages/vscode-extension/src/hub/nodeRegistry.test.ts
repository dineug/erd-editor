import { existsSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';

import { type Platform } from '@dineug/erd-editor-agent-hub';
import { Effect, ManagedRuntime } from 'effect';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';
import type { Uri as VscodeUri } from 'vscode';

import { ErdDocument } from '@/erd-document';
import { registryLive } from '@/hub';
import { DocumentRegistry } from '@/hub/documentRegistry';

import { Uri } from '../../test/mocks/vscode';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(join(os.tmpdir(), 'hub-registry-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

/**
 * Opens a document at each path in a registry over the node layer, the one
 * activate builds, and gives the keys it filed them under.
 */
async function registryKeys(...paths: string[]): Promise<string[]> {
  const registry = DocumentRegistry.makeUnsafe(process.platform as Platform);
  const runtime = ManagedRuntime.make(registryLive(registry));
  await runtime.runPromise(Effect.void);
  for (const path of paths) {
    await registry.register(
      ErdDocument.create(
        Uri.file(path) as unknown as VscodeUri,
        new Uint8Array()
      )
    );
  }
  await runtime.dispose();
  return registry.documents().map(({ path }) => path);
}

describe('the registry over the node layer', () => {
  it('keys a document by its real path, and one that is gone by the path it was given', async () => {
    const target = join(dir, 'target');
    await fs.mkdir(target);
    await fs.writeFile(join(target, 'a.erd.json'), '{}');
    await fs.symlink(target, join(dir, 'link'));

    expect(
      await registryKeys(join(dir, 'link', 'a.erd.json'), join(dir, 'gone'))
    ).toEqual([
      join(await fs.realpath(target), 'a.erd.json'),
      join(dir, 'gone'),
    ]);
  });

  it('keys a document by its spelling on disk, as the MCP server resolves it', async () => {
    const root = await fs.realpath(dir);
    await fs.mkdir(join(root, 'CaseDir'));
    await fs.writeFile(join(root, 'CaseDir', 'Doc.erd.json'), '{}');
    const spelled = join(root, 'CaseDir', 'Doc.erd.json');
    const typed = join(root, 'casedir', 'doc.ERD.json');
    // A case-insensitive disk (macOS, Windows) finds the file either way.
    const expected = existsSync(typed) ? spelled : typed;

    expect(await registryKeys(typed)).toEqual([expected]);
  });

  it('keys a document in a folder named in the other Unicode normalization by its name on disk', async () => {
    const root = await fs.realpath(dir);
    const onDisk = join(root, '프로젝트'.normalize('NFD'));
    await fs.mkdir(onDisk);
    const given = join(root, '프로젝트'.normalize('NFC'));
    // APFS finds it either way, and VS Code hands a macOS path over as NFC.
    const expected = existsSync(given) ? onDisk : given;

    expect(await registryKeys(given)).toEqual([expected]);
  });
});
