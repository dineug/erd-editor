#!/usr/bin/env node
// Measures what the replica side of erd-editor weighs, as JSON; not a gate.
// pnpm size walks the union of the exports, so it cannot see ./engine.js alone
// or the consumer chunks built from it. Run after pnpm build.
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

import { filesOf } from './check-peer-graph.mjs';

const EXPORT_KEY = './engine.js';
const GZIP_LEVEL = 9;
const MARKER = 'editor.initialLoadJson';

/** The consumer chunks that carry ./engine.js, by output directory and name. */
const CONSUMERS = [
  {
    label: 'vscode replicationStore.worker',
    dir: 'packages/vscode-extension/public/static/js',
    prefix: 'replicationStore.worker',
  },
  {
    label: 'intellij replicationStore.worker',
    dir: 'packages/intellij-plugin/src/main/resources/assets/static/js',
    prefix: 'replicationStore.worker',
  },
  {
    label: 'app indexeddb.worker',
    dir: 'packages/app/dist/static/js',
    prefix: 'indexeddb.worker',
  },
  {
    label: 'app indexeddb.shared-worker',
    dir: 'packages/app/dist/static/js',
    prefix: 'indexeddb.shared-worker',
  },
];

/** The marker search reads every file under these, not only the chunks above. */
const MARKER_DIRS = [
  'packages/vscode-extension/public',
  'packages/intellij-plugin/src/main/resources/assets',
  'packages/app/dist/static/js',
];

const USAGE = `Usage: node scripts/measure-engine-footprint.mjs [options]

  --root <dir>        Repository to measure, read only (default: cwd).
  --baseline <json>   An earlier output: adds set, count and byte deltas.
  --help              Print this text.`;

function parseArgs(argv) {
  const options = { root: process.cwd(), baseline: undefined, help: false };

  const valueAt = (i, arg) => {
    if (argv[i] === undefined) throw new Error(`${arg} needs a value`);
    return argv[i];
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--root') {
      options.root = valueAt(++i, arg);
    } else if (arg === '--baseline') {
      options.baseline = valueAt(++i, arg);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { ...options, root: path.resolve(options.root) };
}

/** A library chunk's content hash, which the lib build puts before .js. */
const LIBRARY_HASH = /-[A-Za-z0-9_-]{8}(?=(?:\.[0-9a-f]{8})?\.js(?:\.map)?$)/;

/** An app or webview build's own hash, which follows any library hash. */
const APP_HASH = /\.[0-9a-f]{8}(?=\.js(?:\.map)?$)/;

const stripHashes = name => name.replace(LIBRARY_HASH, '').replace(APP_HASH, '');

const gzipOf = buffer => gzipSync(buffer, { level: GZIP_LEVEL }).byteLength;

const posix = file => file.split(path.sep).join('/');

function engineEntry(root) {
  const packageDir = path.join(root, 'packages', 'erd-editor');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
  );
  const target = manifest.exports?.[EXPORT_KEY];
  const file = typeof target === 'string' ? target : target?.default;
  if (!file) throw new Error(`packages/erd-editor exports no ${EXPORT_KEY}`);

  return path.join(packageDir, file);
}

function measureEngine(root) {
  const entry = engineEntry(root);
  const files = filesOf(entry);
  const buffers = files.map(file => fs.readFileSync(file));
  const perFile = files.map((file, index) => ({
    rawName: posix(path.relative(root, file)),
    strippedBasename: stripHashes(path.basename(file)),
    bytes: buffers[index].byteLength,
  }));

  return {
    exportKey: EXPORT_KEY,
    entry: posix(path.relative(root, entry)),
    files: perFile.map(({ strippedBasename }) => strippedBasename).sort(),
    count: files.length,
    rawBytes: perFile.reduce((sum, { bytes }) => sum + bytes, 0),
    gzipOfConcatenation: gzipOf(Buffer.concat(buffers)),
    perFile,
  };
}

function measureConsumers(root) {
  return CONSUMERS.map(({ label, dir, prefix }) => {
    const absolute = path.join(root, dir);
    const pattern = new RegExp(`^${prefix.replace(/\./g, '\\.')}\\.[^.]+\\.js$`);
    const names = fs.existsSync(absolute)
      ? fs.readdirSync(absolute).filter(name => pattern.test(name)).sort()
      : [];
    const files = names.map(name => {
      const buffer = fs.readFileSync(path.join(absolute, name));
      return { name, bytes: buffer.byteLength, gzip: gzipOf(buffer) };
    });

    return {
      label,
      dir,
      pattern: `${prefix}.*.js`,
      files,
      bytes: files.reduce((sum, { bytes }) => sum + bytes, 0),
      gzip: files.reduce((sum, { gzip }) => sum + gzip, 0),
    };
  });
}

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(file) : [file];
  });
}

function measureMarker(root) {
  const files = MARKER_DIRS.flatMap(dir => walkFiles(path.join(root, dir)))
    .filter(file => fs.readFileSync(file).includes(MARKER))
    .map(file => {
      const relative = posix(path.relative(root, file));
      return {
        path: relative,
        stripped: posix(
          path.join(path.dirname(relative), stripHashes(path.basename(file)))
        ),
        bytes: fs.statSync(file).size,
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  return { marker: MARKER, dirs: MARKER_DIRS, files };
}

const delta = (before, after) => ({ before, after, delta: after - before });

function compareEngine(before, after) {
  const was = new Set(before.files);
  const now = new Set(after.files);

  return {
    sameSet:
      was.size === now.size && [...was].every(name => now.has(name)),
    added: after.files.filter(name => !was.has(name)),
    removed: before.files.filter(name => !now.has(name)),
    count: delta(before.count, after.count),
    rawBytes: delta(before.rawBytes, after.rawBytes),
    gzipOfConcatenation: delta(
      before.gzipOfConcatenation,
      after.gzipOfConcatenation
    ),
  };
}

function compareConsumers(before, after) {
  return after.map(consumer => {
    const earlier = before.find(({ label }) => label === consumer.label);
    return {
      label: consumer.label,
      files: delta(earlier?.files.length ?? 0, consumer.files.length),
      bytes: delta(earlier?.bytes ?? 0, consumer.bytes),
      gzip: delta(earlier?.gzip ?? 0, consumer.gzip),
    };
  });
}

function compareMarker(before, after) {
  const bytesOf = list =>
    new Map(list.files.map(({ stripped, bytes }) => [stripped, bytes]));
  const was = bytesOf(before);
  const now = bytesOf(after);

  return {
    sameList:
      was.size === now.size && [...was.keys()].every(name => now.has(name)),
    added: [...now.keys()].filter(name => !was.has(name)),
    removed: [...was.keys()].filter(name => !now.has(name)),
    bytes: [...now.keys()]
      .filter(name => was.has(name))
      .map(name => ({ file: name, ...delta(was.get(name), now.get(name)) })),
  };
}

function main() {
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
    const report = {
      root: options.root,
      engine: measureEngine(options.root),
      consumers: measureConsumers(options.root),
      auxiliary: measureMarker(options.root),
    };
    const missing = report.consumers
      .filter(({ files }) => files.length === 0)
      .map(({ label }) => label);
    if (missing.length) report.missing = missing;

    if (options.baseline) {
      const before = JSON.parse(fs.readFileSync(options.baseline, 'utf8'));
      report.baseline = {
        file: path.resolve(options.baseline),
        root: before.root,
        engine: compareEngine(before.engine, report.engine),
        consumers: compareConsumers(before.consumers, report.consumers),
        auxiliary: compareMarker(before.auxiliary, report.auxiliary),
      };
    }

    console.log(JSON.stringify(report, null, 2));
    return missing.length ? 1 : 0;
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

process.exitCode = main();
