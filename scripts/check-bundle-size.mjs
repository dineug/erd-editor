#!/usr/bin/env node
// Bundle size gate for the erd-editor library build, wired as pnpm size after
// pnpm build. Verification is the default; the file is written only under
// --set-budget or --update-baseline, each a deliberate, reviewed commit.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const baselinePath = path.join(packageDir, '.size-baseline.json');

/** Gated artifacts, relative to the erd-editor package directory. */
const ENTRIES = ['dist/erd-editor.js'];

/**
 * Compression level every recorded number is measured at. It is stored in the
 * baseline so a zlib change shows up as a mismatch instead of a size jump.
 */
const GZIP_LEVEL = 9;

const USAGE = `Usage: node scripts/check-bundle-size.mjs [options]

  (no options)            Verify dist against ${path.relative(root, baselinePath)}.
  --set-budget            Rewrite only the budget fields. The recorded
                          measurement and baseCommit are left alone, so the
                          delta against the pre-migration bundle survives.
  --update-baseline       Re-record the measurement from the current dist.
                          This moves what every delta is measured from.
  --budget-gzip <bytes>   Set the gzip budget. Pass "none" to leave it
                          undetermined.
  --budget-note <text>    Why that budget is the budget. Printed on every run,
                          so whoever the gate stops reads the reasoning next
                          to the number.
  --base-commit <sha>     With --update-baseline: set baseCommit on a first
                          write. An existing baseCommit is never overwritten
                          without this flag.
  --help                  Print this text.`;

function parseArgs(argv) {
  const options = {
    update: false,
    setBudget: false,
    help: false,
    budgetGzip: undefined,
    budgetNote: undefined,
    baseCommit: undefined,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--update-baseline') {
      options.update = true;
    } else if (arg === '--set-budget') {
      options.setBudget = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--budget-gzip') {
      options.budgetGzip = argv[++i];
    } else if (arg === '--budget-note') {
      options.budgetNote = argv[++i];
    } else if (arg === '--base-commit') {
      options.baseCommit = argv[++i];
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (options.update && options.setBudget) {
    throw new Error('--set-budget and --update-baseline are exclusive');
  }
  if (options.setBudget && options.budgetGzip === undefined) {
    throw new Error('--set-budget needs --budget-gzip');
  }
  if (!options.update && !options.setBudget) {
    if (options.budgetGzip !== undefined) {
      throw new Error('--budget-gzip requires --set-budget or --update-baseline');
    }
    if (options.budgetNote !== undefined) {
      throw new Error('--budget-note requires --set-budget or --update-baseline');
    }
  }
  if (!options.update && options.baseCommit !== undefined) {
    throw new Error('--base-commit requires --update-baseline');
  }

  return options;
}

/** Parses a --budget-gzip value into a byte count, or null for undetermined. */
function parseBudget(value) {
  if (value === undefined) return undefined;
  if (value === 'none') return null;
  const bytes = Number(value);
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`--budget-gzip takes a positive integer or "none": ${value}`);
  }
  return bytes;
}

function measure(entry) {
  const file = path.join(packageDir, entry);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing build output: ${path.relative(root, file)}. Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build`
    );
  }
  const source = fs.readFileSync(file);
  return {
    bytes: source.byteLength,
    gzip: gzipSync(source, { level: GZIP_LEVEL }).byteLength,
  };
}

function readBaseline() {
  if (!fs.existsSync(baselinePath)) return null;
  return JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
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

function verify() {
  const baseline = readBaseline();
  if (!baseline) {
    throw new Error(
      `No baseline at ${path.relative(root, baselinePath)}. Record one with: node scripts/check-bundle-size.mjs --update-baseline`
    );
  }
  if (baseline.gzipLevel !== GZIP_LEVEL) {
    throw new Error(
      `Baseline was recorded at gzip level ${baseline.gzipLevel}, this script measures at ${GZIP_LEVEL}`
    );
  }

  console.log(`baseCommit ${baseline.baseCommit}`);
  console.log(`recorded   ${baseline.recordedAt}`);

  let failed = false;
  let pending = false;

  for (const entry of ENTRIES) {
    const recorded = baseline.entries?.[entry];
    if (!recorded) {
      throw new Error(
        `Baseline has no entry for ${entry}. Re-record with --update-baseline`
      );
    }

    const current = measure(entry);
    const delta = current.gzip - recorded.gzip;
    const budget = recorded.budgetGzip;
    console.log('');
    console.log(entry);
    console.log(`  gzip     ${format(current.gzip)}`);
    console.log(`  baseline ${format(recorded.gzip)}  delta ${signed(delta)}`);
    console.log(`  raw      ${format(current.bytes)}`);

    if (typeof budget !== 'number') {
      pending = true;
      console.log(
        '  budget   undetermined (set one with --set-budget --budget-gzip)'
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
  if (failed) {
    console.log('Bundle size gate: FAIL');
    console.log(
      'The budget watches for an abnormal jump, not for every byte. Find what'
    );
    console.log(
      'grew, or re-pin it with --set-budget --budget-gzip <bytes>.'
    );
    return 1;
  }
  if (pending) {
    console.log('Bundle size gate: reported only, no budget is set yet');
  } else {
    console.log('Bundle size gate: pass');
  }
  return 0;
}

function updateBaseline(options) {
  const previous = readBaseline();
  const budget = parseBudget(options.budgetGzip);
  const note = options.budgetNote;
  const baseCommit =
    options.baseCommit ?? previous?.baseCommit ?? headCommit();
  const entries = {};

  for (const entry of ENTRIES) {
    const current = measure(entry);
    const carried = previous?.entries?.[entry];
    entries[entry] = {
      bytes: current.bytes,
      gzip: current.gzip,
      budgetGzip: budget !== undefined ? budget : (carried?.budgetGzip ?? null),
      budgetNote: note !== undefined ? note : (carried?.budgetNote ?? null),
    };
  }

  const baseline = {
    baseCommit,
    recordedAt: new Date().toISOString(),
    gzipLevel: GZIP_LEVEL,
    entries,
  };

  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, baselinePath)}`);
  for (const entry of ENTRIES) {
    const recorded = baseline.entries[entry];
    const budgetText =
      typeof recorded.budgetGzip === 'number'
        ? format(recorded.budgetGzip)
        : 'undetermined';
    console.log(`  ${entry}  gzip ${format(recorded.gzip)}  budget ${budgetText}`);
  }
  return 0;
}

/**
 * Rewrites the budget without touching the recorded measurement. Splitting this
 * from --update-baseline is what keeps the delta against the pre-migration
 * bundle readable after a budget is re-pinned.
 */
function setBudget(options) {
  const baseline = readBaseline();
  if (!baseline) {
    throw new Error(
      `No baseline at ${path.relative(root, baselinePath)}. Record one with: node scripts/check-bundle-size.mjs --update-baseline`
    );
  }
  const budget = parseBudget(options.budgetGzip);

  for (const entry of ENTRIES) {
    const recorded = baseline.entries?.[entry];
    if (!recorded) {
      throw new Error(
        `Baseline has no entry for ${entry}. Re-record with --update-baseline`
      );
    }
    recorded.budgetGzip = budget;
    if (options.budgetNote !== undefined) {
      recorded.budgetNote = options.budgetNote;
    }
  }

  fs.writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Wrote ${path.relative(root, baselinePath)}`);
  for (const entry of ENTRIES) {
    const recorded = baseline.entries[entry];
    const budgetText =
      typeof recorded.budgetGzip === 'number'
        ? format(recorded.budgetGzip)
        : 'undetermined';
    console.log(`  ${entry}  budget ${budgetText}`);
    console.log(`  ${entry}  measurement left at gzip ${format(recorded.gzip)}`);
  }
  return 0;
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
    if (options.update) return updateBaseline(options);
    if (options.setBudget) return setBudget(options);
    return verify();
  } catch (error) {
    console.error(error.message);
    return 1;
  }
}

process.exit(main());
