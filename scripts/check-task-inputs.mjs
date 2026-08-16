#!/usr/bin/env node
// Keeps each package's `run.tasks` input globs in step with its workspace
// dependencies.
//
// The type gate in `tsconfig.json` covers the shape of those blocks — a typo in
// `from`, `base` or a task key is a TS2769. What it cannot see is a *missing*
// line: add a workspace dependency to `package.json`, forget the matching
// `packages/<dep>/dist/**/*.d.ts` entry, and the config still typechecks while
// that dependency's rebuilds stop waking this package's `tsc --noEmit`. The
// symptom is a green typecheck against a stale `.d.ts`, which is not a symptom
// at all.
//
// Run by `pnpm check`.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const pkgDir = path.join(root, 'packages');
const dirs = fs.readdirSync(pkgDir);

const byName = new Map();
for (const dir of dirs) {
  const manifest = path.join(pkgDir, dir, 'package.json');
  if (!fs.existsSync(manifest)) continue;
  byName.set(JSON.parse(fs.readFileSync(manifest, 'utf8')).name, dir);
}

const problems = [];

for (const dir of dirs) {
  const manifest = path.join(pkgDir, dir, 'package.json');
  if (!fs.existsSync(manifest)) continue;
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));

  const config = ['vite.config.ts', 'vite.config.mts']
    .map(name => path.join(pkgDir, dir, name))
    .find(file => fs.existsSync(file));
  if (!config) continue;

  const source = fs.readFileSync(config, 'utf8');
  if (!source.includes('run: {')) continue;

  const declared = new Set();
  for (const field of [
    'dependencies',
    'devDependencies',
    'peerDependencies',
  ]) {
    for (const name of Object.keys(pkg[field] ?? {})) {
      const depDir = byName.get(name);
      if (depDir && depDir !== dir) declared.add(depDir);
    }
  }

  const tracked = new Set(
    [...source.matchAll(/packages\/([^/'"]+)\/dist\/\*\*\/\*\.d\.ts/g)].map(
      match => match[1]
    )
  );

  for (const dep of declared) {
    if (!tracked.has(dep)) {
      problems.push(
        `${dir}: depends on ${dep} but no input glob tracks its .d.ts — ` +
          `rebuilds of ${dep} will not re-run this package's typecheck`
      );
    }
  }
  for (const dep of tracked) {
    if (!declared.has(dep)) {
      problems.push(
        `${dir}: tracks packages/${dep}/dist but no longer depends on it — ` +
          `this package wakes up for changes that cannot affect it`
      );
    }
  }
}

if (problems.length) {
  console.error('run.tasks input globs are out of step with package.json:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `run.tasks inputs match package.json across ${dirs.length} packages`
);
