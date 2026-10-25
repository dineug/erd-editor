#!/usr/bin/env node
// Bundle size gate for the erd-editor library build, wired as pnpm size after
// pnpm build. Verification is the default; the file is written only under
// --set-budget or --update-baseline, each a deliberate, reviewed commit.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { rolldown } from 'vite/rolldown';

import { createExternal } from '../tools/vite/package-metadata.ts';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const baselinePath = path.join(packageDir, '.size-baseline.json');

/**
 * The script-tag builds, each recorded under umd:<name> and measured as
 * built, since a page loads it whole.
 */
const UMD_FILES = [
  { key: 'umd:erd-editor', file: './dist/erd-editor.umd.js' },
  { key: 'umd:erd-viewer', file: './dist/erd-viewer.umd.js' },
];

/** The two records the ratio line compares. */
const VIEWER_KEY = './erd-viewer.js';
const EDITOR_KEY = './erd-editor.js';

/** A worker file a module names, in whichever quote the minifier picked. */
const WORKER_URL =
  /new URL\(\s*(["'`])(\.{1,2}\/[^"'`]+?\.js)\1\s*,\s*import\.meta\.url\s*\)/g;

/**
 * Compression level every recorded number is measured at. It is stored in the
 * baseline so a zlib change shows up as a mismatch instead of a size jump.
 */
const GZIP_LEVEL = 9;

const USAGE = `Usage: node scripts/check-bundle-size.mjs [options]

  Each exports key of @dineug/erd-editor is bundled from dist/ as a consumer
  would, its dependencies and peers external and the output minified. gzip
  sums the entry chunk, the chunks it imports statically and the worker files
  those name, each worker bundled on its own and every file compressed on its
  own; lazyGzip sums the chunks reached only through import() and the workers
  only they name. The two umd files are measured as they are, under the keys
  umd:erd-editor and umd:erd-viewer.

  (no options)            Verify dist against ${path.relative(root, baselinePath)}.
  --set-budget            Rewrite only one record's budget fields. The recorded
                          measurement and baseCommit are left alone.
  --entry <key>           With --set-budget: the record to rewrite, an exports
                          key or umd:<name> as the baseline names it.
  --budget-gzip <bytes>   With --set-budget: the gzip budget. Pass "none" to
                          leave it undetermined, so the record only prints.
  --budget-note <text>    With --set-budget: why that budget is the budget.
                          Printed on every run, so whoever the gate stops
                          reads the reasoning next to the number.
  --update-baseline       Re-record every measurement from the current dist,
                          keeping each record's budget and note. This moves
                          what every delta is measured from.
  --base-commit <sha>     With --update-baseline: set baseCommit. An existing
                          baseCommit is never overwritten without this flag.
  --help                  Print this text.`;

function parseArgs(argv) {
  const options = {
    update: false,
    setBudget: false,
    help: false,
    entry: undefined,
    budgetGzip: undefined,
    budgetNote: undefined,
    baseCommit: undefined,
  };

  const valueAt = (i, arg) => {
    if (argv[i] === undefined) throw new Error(`${arg} needs a value`);
    return argv[i];
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--update-baseline') {
      options.update = true;
    } else if (arg === '--set-budget') {
      options.setBudget = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--entry') {
      options.entry = valueAt(++i, arg);
    } else if (arg === '--budget-gzip') {
      options.budgetGzip = valueAt(++i, arg);
    } else if (arg === '--budget-note') {
      options.budgetNote = valueAt(++i, arg);
    } else if (arg === '--base-commit') {
      options.baseCommit = valueAt(++i, arg);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.update && options.setBudget) {
    throw new Error('--set-budget and --update-baseline are exclusive');
  }
  if (options.setBudget) {
    if (options.entry === undefined) {
      throw new Error('--set-budget needs --entry');
    }
    if (options.budgetGzip === undefined) {
      throw new Error('--set-budget needs --budget-gzip');
    }
  } else {
    for (const [flag, value] of [
      ['--entry', options.entry],
      ['--budget-gzip', options.budgetGzip],
      ['--budget-note', options.budgetNote],
    ]) {
      if (value !== undefined) throw new Error(`${flag} requires --set-budget`);
    }
  }
  if (!options.update && options.baseCommit !== undefined) {
    throw new Error('--base-commit requires --update-baseline');
  }

  return options;
}

/** Parses a --budget-gzip value into a byte count, or null for undetermined. */
function parseBudget(value) {
  if (value === 'none') return null;
  const bytes = Number(value);
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`--budget-gzip takes a positive integer or "none": ${value}`);
  }
  return bytes;
}

const MISSING_OUTPUT =
  'Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build';

function readManifest() {
  return JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
}

function ensureBuilt(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing build output: ${path.relative(root, file)}. ${MISSING_OUTPUT}`
    );
  }
}

/** The records in print order: every exports key, then the umd files. */
function targetsOf(manifest) {
  const exported = Object.entries(manifest.exports).map(([key, target]) => ({
    key,
    file: path.join(
      packageDir,
      typeof target === 'string' ? target : target.default
    ),
    kind: 'module',
  }));
  const umd = UMD_FILES.map(({ key, file }) => ({
    key,
    file: path.join(packageDir, file),
    kind: 'umd',
  }));
  return [...exported, ...umd];
}

const gzipOf = code => gzipSync(code, { level: GZIP_LEVEL }).byteLength;

const sum = (files, field) =>
  files.reduce((total, file) => total + file[field], 0);

/**
 * Bundles one built file as a consumer's production build would: the
 * package's dependencies and peers stay imports, the rest is inlined and
 * minified. Nothing is written.
 */
async function bundle(file, external) {
  ensureBuilt(file);
  const build = await rolldown({
    input: file,
    cwd: packageDir,
    external,
    platform: 'browser',
    logLevel: 'silent',
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  });
  try {
    const { output } = await build.generate({
      format: 'es',
      minify: true,
      entryFileNames: '[name].js',
      chunkFileNames: '[name].js',
    });
    return output.filter(item => item.type === 'chunk');
  } finally {
    await build.close();
  }
}

/**
 * Splits a bundle into what loads with its entry and what waits for an
 * import(), and finds the worker files each half names. A worker named from
 * both halves loads with the entry.
 */
function splitBundle(chunks, nameOf) {
  const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
  const eager = new Set();
  const pending = chunks
    .filter(chunk => chunk.isEntry)
    .map(chunk => chunk.fileName);
  while (pending.length) {
    const name = pending.pop();
    if (eager.has(name)) continue;
    eager.add(name);
    pending.push(...byName.get(name).imports.filter(next => byName.has(next)));
  }

  const workers = new Map();
  const part = chunk => ({
    name: nameOf(chunk),
    bytes: Buffer.byteLength(chunk.code),
    gzip: gzipOf(chunk.code),
  });
  const result = { eager: [], lazy: [], workers };
  for (const chunk of chunks) {
    const isEager = eager.has(chunk.fileName);
    (isEager ? result.eager : result.lazy).push(part(chunk));
    for (const [id, module] of Object.entries(chunk.modules)) {
      for (const match of (module.code ?? '').matchAll(WORKER_URL)) {
        const worker = path.resolve(path.dirname(id), match[2]);
        workers.set(worker, workers.get(worker) || isEager);
      }
    }
  }
  return result;
}

/** Measures one exports key, bundling each worker file its code names on its own. */
async function measureModule(file, external, workerCache) {
  const main = splitBundle(
    await bundle(file, external),
    chunk => chunk.fileName
  );
  const eager = [...main.eager];
  const lazy = [...main.lazy];

  for (const [worker, isEager] of main.workers) {
    if (!workerCache.has(worker)) {
      const label = path
        .relative(packageDir, worker)
        .split(path.sep)
        .join('/');
      const nameOf = chunk =>
        chunk.isEntry ? label : `${label} > ${chunk.fileName}`;
      workerCache.set(worker, splitBundle(await bundle(worker, external), nameOf));
    }
    const measured = workerCache.get(worker);
    (isEager ? eager : lazy).push(...measured.eager);
    lazy.push(...measured.lazy);
  }

  return { eager, lazy };
}

/** A umd file loads whole from a script tag, so it is measured as built. */
function measureUmd(file) {
  ensureBuilt(file);
  const code = fs.readFileSync(file);
  return {
    eager: [
      { name: path.basename(file), bytes: code.byteLength, gzip: gzipOf(code) },
    ],
    lazy: [],
  };
}

async function measureAll() {
  const manifest = readManifest();
  const external = createExternal(manifest);
  const workerCache = new Map();
  const measured = [];

  for (const target of targetsOf(manifest)) {
    const parts =
      target.kind === 'umd'
        ? measureUmd(target.file)
        : await measureModule(target.file, external, workerCache);
    measured.push({
      key: target.key,
      parts,
      bytes: sum(parts.eager, 'bytes'),
      gzip: sum(parts.eager, 'gzip'),
      lazyGzip: sum(parts.lazy, 'gzip'),
    });
  }

  return measured;
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
}

function requireBaseline() {
  const baseline = readBaseline();
  if (!baseline) {
    throw new Error(
      `No baseline at ${path.relative(root, baselinePath)}. Record one with: node scripts/check-bundle-size.mjs --update-baseline`
    );
  }
  return baseline;
}

function writeBaseline(baseline) {
  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, baselinePath)}`);
}

function headCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
}

function format(bytes) {
  return `${bytes.toLocaleString('en-US')} B (${(bytes / 1024).toFixed(1)} kB)`;
}

function signed(delta) {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toLocaleString('en-US')} B`;
}

function budgetText(record) {
  return typeof record.budgetGzip === 'number'
    ? format(record.budgetGzip)
    : 'undetermined';
}

function printParts(parts) {
  for (const part of parts) {
    console.log(`           ${format(part.gzip)}  ${part.name}`);
  }
}

/** The one line the viewer's weight is read from, beside the editor's. */
function printRatio(measured) {
  const viewer = measured.find(entry => entry.key === VIEWER_KEY);
  const editor = measured.find(entry => entry.key === EDITOR_KEY);
  if (!viewer || !editor) return;
  const ratio = ((viewer.gzip / editor.gzip) * 100).toFixed(1);
  console.log(
    `${VIEWER_KEY} gzip ${format(viewer.gzip)}, lazyGzip ${format(viewer.lazyGzip)}; ${EDITOR_KEY} gzip ${format(editor.gzip)}; ratio ${ratio}%`
  );
}

async function verify() {
  const baseline = requireBaseline();
  if (baseline.gzipLevel !== GZIP_LEVEL) {
    throw new Error(
      `Baseline was recorded at gzip level ${baseline.gzipLevel}, this script measures at ${GZIP_LEVEL}`
    );
  }

  const measured = await measureAll();
  const recordedKeys = Object.keys(baseline.entries ?? {});
  const stale = recordedKeys.filter(
    key => !measured.some(entry => entry.key === key)
  );
  if (stale.length) {
    throw new Error(
      `Baseline records ${stale.join(', ')}, which the build no longer has. Re-record with --update-baseline`
    );
  }

  console.log(`baseCommit ${baseline.baseCommit}`);
  console.log(`recorded   ${baseline.recordedAt}`);

  let failed = false;
  let unbudgeted = 0;

  for (const current of measured) {
    const recorded = baseline.entries?.[current.key];
    if (!recorded) {
      throw new Error(
        `Baseline has no record for ${current.key}. Re-record with --update-baseline`
      );
    }

    console.log('');
    console.log(current.key);
    console.log(`  gzip     ${format(current.gzip)}`);
    console.log(
      `  baseline ${format(recorded.gzip)}  delta ${signed(current.gzip - recorded.gzip)}`
    );
    console.log(`  raw      ${format(current.bytes)}`);
    printParts(current.parts.eager);
    console.log(
      `  lazyGzip ${format(current.lazyGzip)}  baseline ${format(recorded.lazyGzip)}  delta ${signed(current.lazyGzip - recorded.lazyGzip)}`
    );
    printParts(current.parts.lazy);

    const budget = recorded.budgetGzip;
    if (typeof budget !== 'number') {
      unbudgeted++;
      console.log(
        '  budget   undetermined, reported only (set one with --set-budget)'
      );
      continue;
    }
    console.log(`  budget   ${format(budget)}`);
    if (recorded.budgetNote) {
      console.log(`  why      ${recorded.budgetNote}`);
    }
    if (current.gzip > budget) {
      failed = true;
      console.log(`  FAIL     over budget by ${signed(current.gzip - budget)}`);
    } else {
      console.log(`  ok       ${signed(current.gzip - budget)} against budget`);
    }
  }

  console.log('');
  printRatio(measured);
  console.log('');
  if (failed) {
    console.log('Bundle size gate: FAIL');
    console.log(
      'The budget watches for an abnormal jump, not for every byte. Find what'
    );
    console.log(
      'grew, or re-pin it with --set-budget --entry <key> --budget-gzip <bytes>.'
    );
    return 1;
  }
  console.log(
    `Bundle size gate: pass, ${unbudgeted} of ${measured.length} records reported only with no budget`
  );
  return 0;
}

async function updateBaseline(options) {
  const previous = readBaseline();
  const measured = await measureAll();
  const entries = {};

  for (const current of measured) {
    const carried = previous?.entries?.[current.key];
    entries[current.key] = {
      bytes: current.bytes,
      gzip: current.gzip,
      lazyGzip: current.lazyGzip,
      budgetGzip: carried?.budgetGzip ?? null,
      budgetNote: carried?.budgetNote ?? null,
    };
  }

  const baseline = {
    baseCommit: options.baseCommit ?? previous?.baseCommit ?? headCommit(),
    recordedAt: new Date().toISOString(),
    gzipLevel: GZIP_LEVEL,
    entries,
  };

  writeBaseline(baseline);
  for (const [key, record] of Object.entries(baseline.entries)) {
    console.log(
      `  ${key}  gzip ${format(record.gzip)}  lazyGzip ${format(record.lazyGzip)}  budget ${budgetText(record)}`
    );
  }
  console.log('');
  printRatio(measured);
  return 0;
}

/** Rewrites one record's budget without touching any recorded measurement. */
function setBudget(options) {
  const baseline = requireBaseline();
  const budget = parseBudget(options.budgetGzip);
  const record = baseline.entries?.[options.entry];
  if (!record) {
    throw new Error(
      `Baseline has no record for ${options.entry}. It records: ${Object.keys(baseline.entries ?? {}).join(', ')}`
    );
  }

  record.budgetGzip = budget;
  if (options.budgetNote !== undefined) {
    record.budgetNote = options.budgetNote;
  }

  writeBaseline(baseline);
  console.log(`  ${options.entry}  budget ${budgetText(record)}`);
  console.log(
    `  ${options.entry}  measurement left at gzip ${format(record.gzip)}`
  );
  return 0;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('');
    console.error(USAGE);
    return 2;
  }

  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  try {
    if (options.update) return await updateBaseline(options);
    if (options.setBudget) return setBudget(options);
    return await verify();
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

process.exit(await main());
