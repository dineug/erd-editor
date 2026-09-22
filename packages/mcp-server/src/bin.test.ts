import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

const packageDir = join(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8')
);
const bin = join(packageDir, manifest.bin['erd-editor-mcp']);

/**
 * The specifiers of the import statements that open an ESM file, where the
 * bundler hoists every static import. Scanning the whole text would also hit
 * code the bundle carries as strings, such as the source ajv generates.
 */
function leadingImports(source: string): string[] {
  const statement =
    /^\s*import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["']([^"']+)["']\s*;?/;
  const specifiers: string[] = [];
  let rest = source.replace(/^#!.*\n/, '');
  for (let match = statement.exec(rest); match; match = statement.exec(rest)) {
    specifiers.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return specifiers;
}

/** Talks to the built file over stdio, one JSON-RPC line at a time. */
function exchange(
  file: string,
  messages: object[]
): Promise<{ lines: any[]; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { cwd: tmpdir() });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      const lines = stdout.split('\n').filter(Boolean);
      if (lines.length >= messages.filter(m => 'id' in m).length) {
        child.stdin.end();
      }
    });
    child.on('error', reject);
    child.on('close', code => {
      resolve({
        lines: stdout
          .split('\n')
          .filter(Boolean)
          .map(line => JSON.parse(line)),
        code,
      });
    });
    for (const message of messages) {
      child.stdin.write(`${JSON.stringify(message)}\n`);
    }
  });
}

describe('the built single file (AC-M9, AC-P7)', () => {
  it('exists where package.json bin points, readable and runnable', () => {
    expect(existsSync(bin)).toBe(true);
    expect(statSync(bin).size).toBeGreaterThan(0);
  });

  it('starts with the shebang line', () => {
    expect(readFileSync(bin, 'utf8').split('\n')[0]).toBe(
      '#!/usr/bin/env node'
    );
  });

  it('imports nothing but node builtins, statically or by a dynamic import', () => {
    const source = readFileSync(bin, 'utf8');
    const imports = leadingImports(source);
    const builtins = new Set(builtinModules);

    expect(imports.length).toBeGreaterThan(0);
    expect(
      imports.filter(
        specifier => !specifier.startsWith('node:') && !builtins.has(specifier)
      )
    ).toEqual([]);
    expect(source.match(/(?<![\w$.])import\s*\(\s*["'`]/g)).toBeNull();
  });

  it('answers initialize and tools/list over stdio from a folder with no node_modules, then exits when stdin ends', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'erd-mcp-bin-'));
    const lone = join(dir, 'erd-editor-mcp.js');
    await copyFile(bin, lone);

    const { lines, code } = await exchange(lone, [
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'bin-test', version: '1.0.0' },
        },
      },
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    ]);

    expect(lines[0].result.serverInfo).toEqual({
      name: 'erd-editor',
      version: manifest.version,
    });
    expect(lines[1].result.tools).toHaveLength(59);
    expect(code).toBe(0);
    await rm(dir, { recursive: true, force: true });
  }, 20_000);
});
