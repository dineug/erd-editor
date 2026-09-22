#!/usr/bin/env node
// Artifact gate for @dineug/erd-editor/agent.js, wired as pnpm agent-graph
// after pnpm build. The MCP server inlines what that entry reaches into a Node
// process, so those files may hold no browser token and import few packages.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const EXPORT_KEY = './agent.js';

/**
 * The packages the built engine chunks may import, the same list as the source
 * half of this gate in src/agent/imports.test.ts. Keep the two equal.
 */
const BARE_ALLOWLIST = new Set([
  'deepmerge',
  'es-toolkit',
  'es-toolkit/compat',
  'graphql',
  'luxon',
  'nanoid',
  'rxjs',
]);

/**
 * A relative script in emitted code: check-bundle-size.mjs's import, dynamic
 * import and worker url, plus a side effect import, which that walk skips.
 */
const RELATIVE_SCRIPT =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)["'](\.{1,2}\/[^"']+\.js)["']|new URL\(["'](\.{1,2}\/[^"']+\.js)["'],\s*import\.meta\.url\)/g;

/**
 * A package named by a static import, a re-export, a side effect import or
 * import(). The first character rules out relative paths and string data.
 */
const BARE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(?\s*)["']([@#\w][\w@:/.+~-]*)["']/g;

/**
 * Five browser tokens a Node process lacks, read or constructed. Not every
 * global: r-html's instanceof Node stays, unreached while observation is off.
 */
const DOM_TOKEN =
  /\b(?:SharedWorker|customElements|document\.|window\.|navigator\.)/g;

const MISSING_OUTPUT =
  'Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build';

function agentEntry() {
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const target = manifest.exports?.[EXPORT_KEY];
  const file = typeof target === 'string' ? target : target?.default;
  if (!file) {
    throw new Error(
      `packages/erd-editor/package.json exports no ${EXPORT_KEY}`
    );
  }
  return path.join(packageDir, file);
}

/**
 * Every script reachable from an entry through its static and dynamic imports
 * and the worker files it names; a stale chunk a cache replay left beside the
 * live one is unreachable. measure-engine-footprint.mjs walks ./engine.js too.
 */
export function filesOf(entry) {
  const reached = new Set();
  const pending = [entry];

  while (pending.length) {
    const file = pending.pop();
    if (reached.has(file)) continue;
    if (!fs.existsSync(file)) {
      throw new Error(
        `Missing build output: ${path.relative(root, file)}. ${MISSING_OUTPUT}`
      );
    }
    reached.add(file);
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(RELATIVE_SCRIPT)) {
      pending.push(path.resolve(path.dirname(file), match[1] ?? match[2]));
    }
  }

  return [...reached].sort();
}

const lineOf = (code, index) => code.slice(0, index).split('\n').length;

function scan(files) {
  const bare = new Map();
  const domTokens = [];

  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const name = path.relative(packageDir, file);
    for (const match of code.matchAll(BARE_SPECIFIER)) {
      const importers = bare.get(match[1]) ?? new Set();
      importers.add(name);
      bare.set(match[1], importers);
    }
    for (const match of code.matchAll(DOM_TOKEN)) {
      domTokens.push(`${name}:${lineOf(code, match.index)}  ${match[0]}`);
    }
  }

  return { bare, domTokens };
}

function verify() {
  const entry = agentEntry();
  const files = filesOf(entry);
  const { bare, domTokens } = scan(files);
  const specifiers = [...bare.keys()].sort();
  const offenders = specifiers.filter(name => !BARE_ALLOWLIST.has(name));
  const width = Math.max(0, ...specifiers.map(name => name.length));

  console.log(`${EXPORT_KEY} -> ${path.relative(root, entry)}`);
  console.log('');
  console.log(`files reached (${files.length})`);
  for (const file of files) console.log(`  ${path.relative(root, file)}`);
  console.log('');
  console.log(`bare imports (${specifiers.length})`);
  for (const name of specifiers) {
    const mark = BARE_ALLOWLIST.has(name) ? 'ok  ' : 'FAIL';
    const importers = [...bare.get(name)].sort().join(', ');
    console.log(`  ${mark} ${name.padEnd(width)}  ${importers}`);
  }
  console.log(`  allowed: ${[...BARE_ALLOWLIST].join(', ')}`);
  console.log('');
  console.log(`browser tokens (${domTokens.length})`);
  for (const token of domTokens) console.log(`  FAIL ${token}`);
  console.log('');

  if (offenders.length || domTokens.length) {
    console.log('Agent graph gate: FAIL');
    console.log(
      'The MCP server runs this graph in Node and inlines every import. Keep'
    );
    console.log(
      'browser code out of it, or allow a package here and in imports.test.ts.'
    );
    return 1;
  }
  console.log('Agent graph gate: pass');
  return 0;
}

const realpathOf = file => fs.realpathSync(path.resolve(file));

// Run as the gate only, so importing filesOf judges nothing. Both sides go
// through realpath: the loader resolves symlinks in import.meta.url and not in
// argv, so a linked path such as macOS /tmp would otherwise skip the gate.
if (
  process.argv[1] !== undefined &&
  realpathOf(process.argv[1]) === realpathOf(fileURLToPath(import.meta.url))
) {
  try {
    process.exitCode = verify();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
