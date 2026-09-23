import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vite-plus/test';

const packageDir = join(import.meta.dirname, '..');
const manifest = JSON.parse(
  readFileSync(join(packageDir, 'package.json'), 'utf8')
);
const bin = join(packageDir, manifest.bin['erd-editor-mcp']);

/**
 * The gzip size, level 9, the built file may reach: 15% over the 208,191 bytes
 * spike S1 projected for the server on effect's McpServer (plan D5); npx
 * downloads the file on every cold start. Sizes by this spec's zlib: AGENTS.md.
 */
const BUNDLE_GZIP_BUDGET = 239_420;

/**
 * The specifiers of the import statements that open an ESM file, where the
 * bundler hoists every static import. Scanning the whole text would also hit
 * an import the bundle only quotes, inside a string or a template.
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

/**
 * Talks to the built file over stdio, one JSON-RPC line at a time, and ends
 * stdin once every request has its response. A notification the server sends
 * on its own, such as tools/list_changed, is a line too, so ids are counted.
 */
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
      const responses = stdout
        .split('\n')
        .slice(0, -1)
        .filter(line => 'id' in JSON.parse(line));
      if (responses.length >= messages.filter(m => 'id' in m).length) {
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

  it('stays within its gzip budget', () => {
    const gzip = gzipSync(readFileSync(bin), { level: 9 }).length;
    // An observation beside the gate, for the size table in AGENTS.md.
    console.info(`erd-editor-mcp.js: gzip level 9 ${gzip} bytes`);
    expect(gzip).toBeLessThanOrEqual(BUNDLE_GZIP_BUDGET);
  });

  it('carries neither ws nor undici, nor the effect modules that reach a dynamic import', () => {
    const source = readFileSync(bin, 'utf8');

    expect(source.match(/Sec-WebSocket-Accept/g)).toBeNull();
    expect(source.match(/undici/gi)).toBeNull();
    expect(source.match(/SchemaAOTCompiler|Migrator/g)).toBeNull();
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

    const byId = new Map(lines.map(line => [line.id, line]));
    expect(byId.get(1).result.serverInfo).toEqual({
      name: 'erd-editor',
      version: manifest.version,
    });
    expect(byId.get(2).result.tools).toHaveLength(59);
    expect(lines.every(line => line.jsonrpc === '2.0')).toBe(true);
    expect(code).toBe(0);
    await rm(dir, { recursive: true, force: true });
  }, 20_000);
});
