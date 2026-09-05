#!/usr/bin/env node
// Keeps Vite task cache inputs in step with tsconfig files and workspace
// dependencies. Library tasks are generated, so this checker calculates their
// expected shape independently and compares it with the factory output.
import fs from 'node:fs';
import path from 'node:path';
import { inspect, isDeepStrictEqual } from 'node:util';

import { createLibraryTasks } from '../tools/vite/library-config.ts';

const root = path.resolve(import.meta.dirname, '..');
const packagesDir = path.join(root, 'packages');
const packageDirs = fs.readdirSync(packagesDir);
const packagesByName = new Map();
const problems = [];

function stripJsonComments(source) {
  let output = '';
  let inString = false;

  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    const next = source[i + 1];

    if (inString) {
      output += char;
      if (char === '\\') {
        output += next ?? '';
        i++;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }
    if (char === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      output += '\n';
      continue;
    }
    if (char === '/' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        if (source[i] === '\n') output += '\n';
        i++;
      }
      i++;
      continue;
    }
    output += char;
  }

  return output;
}

function readJson(pathname) {
  return JSON.parse(fs.readFileSync(pathname, 'utf8'));
}

function readJsonc(pathname) {
  return JSON.parse(stripJsonComments(fs.readFileSync(pathname, 'utf8')));
}

function toPosix(pathname) {
  return path.sep === '/'
    ? pathname
    : pathname.split(path.sep).join('/');
}

function toInput(pathname, packageDir) {
  const absolute = path.isAbsolute(pathname)
    ? pathname
    : path.resolve(packageDir, pathname);
  const packageRelative = path.relative(packageDir, absolute);

  if (
    !packageRelative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(packageRelative)
  ) {
    return toPosix(packageRelative);
  }

  const workspaceRelative = path.relative(root, absolute);
  if (
    workspaceRelative === '..' ||
    workspaceRelative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(workspaceRelative)
  ) {
    throw new Error(`workspace 밖의 설정 입력이다: ${pathname}`);
  }

  return { pattern: toPosix(workspaceRelative), base: 'workspace' };
}

function includeInput(entry, packageDir) {
  return toInput(path.extname(entry) ? entry : `${entry}/**`, packageDir);
}

function localConfigInputs(packageDir) {
  const files = new Set(fs.readdirSync(packageDir));
  const inputs = [];

  for (const name of [
    'vite.config.ts',
    'vite.config.mts',
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.setup.ts',
    'vitest.setup.mts',
  ]) {
    if (files.has(name)) inputs.push(name);
  }
  inputs.push(
    ...[...files]
      .filter(name => /^tsconfig\..+\.json$/.test(name))
      .sort()
  );

  return inputs;
}

function extendedConfigInputs(configPath, packageDir, packageName) {
  const inputs = [];
  const visited = new Set();

  function visit(pathname) {
    const config = readJsonc(pathname);
    const entries = Array.isArray(config.extends)
      ? config.extends
      : config.extends
        ? [config.extends]
        : [];

    for (const entry of entries) {
      if (!entry.startsWith('.') && !path.isAbsolute(entry)) {
        problems.push(
          `${packageName}: unsupported package tsconfig extends ${entry}`
        );
        continue;
      }
      const resolved = path.resolve(
        path.dirname(pathname),
        path.extname(entry) ? entry : `${entry}.json`
      );
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      inputs.push(toInput(resolved, packageDir));
      visit(resolved);
    }
  }

  visit(configPath);
  return inputs;
}

for (const dir of packageDirs) {
  const packageDir = path.join(packagesDir, dir);
  const manifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;

  packagesByName.set(readJson(manifestPath).name, {
    dir,
    manifest: readJson(manifestPath),
  });
}

function workspaceDeclarationDeps(dir, manifest) {
  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  });
  const result = [];

  for (const name of dependencies) {
    const workspacePackage = packagesByName.get(name);
    const types =
      workspacePackage?.manifest.types ?? workspacePackage?.manifest.typings;
    if (!workspacePackage || workspacePackage.dir === dir) continue;
    if (types?.includes('dist/')) result.push(workspacePackage.dir);
  }

  return result;
}

function expectedTypeInputs(dir, manifest) {
  const packageDir = path.join(packagesDir, dir);
  const tsconfigPath = path.join(packageDir, 'tsconfig.json');
  const tsconfig = readJsonc(tsconfigPath);
  const inputs = [
    { auto: true },
    ...(tsconfig.include ?? []).map(entry =>
      includeInput(entry, packageDir)
    ),
    ...localConfigInputs(packageDir),
    'package.json',
    'tsconfig.json',
    ...extendedConfigInputs(tsconfigPath, packageDir, dir),
    { pattern: 'build-target.ts', base: 'workspace' },
    { pattern: 'tools/vite/**', base: 'workspace' },
  ];

  for (const dependency of workspaceDeclarationDeps(dir, manifest)) {
    inputs.push({
      pattern: `packages/${dependency}/dist/**/*.d.ts`,
      base: 'workspace',
    });
  }
  inputs.push('!**/*.tsbuildinfo');

  return inputs;
}

function expectedLibraryTasks(dir, manifest) {
  const typeGateInput = expectedTypeInputs(dir, manifest);
  const dependsOn = [
    {
      task: 'build',
      from: ['dependencies', 'devDependencies', 'peerDependencies'],
    },
  ];
  const tasks = {
    build: {
      command: ['tsc --noEmit', 'vp build'],
      dependsOn,
      input: [...typeGateInput, '!dist/**'],
      output: ['dist/**'],
    },
  };
  const packageDir = path.join(packagesDir, dir);

  if (
    localConfigInputs(packageDir).some(input =>
      input.startsWith('vitest.config.')
    )
  ) {
    tasks.test = {
      command: ['tsc --noEmit', 'vp test run'],
      dependsOn,
      input: [...typeGateInput],
    };
  }

  return tasks;
}

function findViteConfig(packageDir) {
  return ['vite.config.ts', 'vite.config.mts']
    .map(name => path.join(packageDir, name))
    .find(pathname => fs.existsSync(pathname));
}

function validateBespokeTaskInputs(dir, manifest, source) {
  const declared = new Set(workspaceDeclarationDeps(dir, manifest));
  const tracked = new Set(
    [...source.matchAll(/packages\/([^/'"]+)\/dist\/\*\*\/\*\.d\.ts/g)].map(
      match => match[1]
    )
  );

  for (const dependency of declared) {
    if (!tracked.has(dependency)) {
      problems.push(
        `${dir}: depends on ${dependency} but no input glob tracks its .d.ts`
      );
    }
  }
  for (const dependency of tracked) {
    if (!declared.has(dependency)) {
      problems.push(
        `${dir}: tracks packages/${dependency}/dist without a declaration dependency`
      );
    }
  }
}

function hasToolDeclarations(packageDir) {
  const distDir = path.join(packageDir, 'dist');
  if (!fs.existsSync(distDir)) return false;

  const pending = [distDir];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const pathname = path.join(current, entry.name);
      if (entry.isDirectory()) {
        pending.push(pathname);
      } else if (
        toPosix(path.relative(distDir, pathname)).includes('tools/vite/')
      ) {
        return true;
      }
    }
  }
  return false;
}

let libraryCount = 0;
let factoryCount = 0;
let sharedTaskCount = 0;

for (const dir of packageDirs) {
  const packageDir = path.join(packagesDir, dir);
  const manifestPath = path.join(packageDir, 'package.json');
  if (!fs.existsSync(manifestPath)) continue;

  const manifest = readJson(manifestPath);
  const configPath = findViteConfig(packageDir);
  if (!configPath) continue;

  const source = fs.readFileSync(configPath, 'utf8');
  const publishesDeclarations = (manifest.types ?? manifest.typings)?.includes(
    'dist/'
  );
  if (publishesDeclarations) {
    libraryCount++;
    const usesFactory = source.includes('defineLibraryConfig');
    const usesSharedTasks = source.includes('createLibraryTasks');

    if (usesFactory === usesSharedTasks) {
      problems.push(`${dir}: expected exactly one shared library config helper`);
      continue;
    }
    if (usesFactory) factoryCount++;
    if (usesSharedTasks) sharedTaskCount++;

    const actual = createLibraryTasks(packageDir);
    const expected = expectedLibraryTasks(dir, manifest);
    if (!isDeepStrictEqual(actual, expected)) {
      problems.push(
        `${dir}: generated task contract differs from independent inputs\n` +
          `    expected ${inspect(expected, { depth: null })}\n` +
          `    actual   ${inspect(actual, { depth: null })}`
      );
    }
    if (hasToolDeclarations(packageDir)) {
      problems.push(`${dir}: dist contains declarations from tools/vite`);
    }
    continue;
  }

  if (source.includes('run: {')) {
    validateBespokeTaskInputs(dir, manifest, source);
  }
}

if (libraryCount !== 8) {
  problems.push(`expected 8 library configs, found ${libraryCount}`);
}
if (factoryCount !== 6) {
  problems.push(`expected 6 defineLibraryConfig consumers, found ${factoryCount}`);
}
if (sharedTaskCount !== 2) {
  problems.push(
    `expected 2 bespoke createLibraryTasks consumers, found ${sharedTaskCount}`
  );
}

if (problems.length) {
  console.error('task configuration validation failed:\n');
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(
  `task inputs and dependency declarations match across ${packageDirs.length} packages`
);
