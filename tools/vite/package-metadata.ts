import { readFileSync, readdirSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

export type TypeGateInput =
  | string
  | { auto: true }
  | { pattern: string; base: 'workspace' };

export interface PackageManifest {
  name: string;
  version: string;
  types?: string;
  typings?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface TsConfig {
  extends?: string | string[];
  include?: string[];
}

interface WorkspacePackage {
  dir: string;
  manifest: PackageManifest;
}

export interface LibraryMetadata {
  manifest: PackageManifest;
  hasTest: boolean;
  typeGateInput: TypeGateInput[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function readJsonc<T>(path: string): T {
  return JSON.parse(stripJsonComments(readFileSync(path, 'utf8'))) as T;
}

function stripJsonComments(source: string): string {
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

function toPosix(path: string): string {
  return sep === '/' ? path : path.split(sep).join('/');
}

function includeToGlob(entry: string): string {
  return extname(entry) ? entry : `${entry}/**`;
}

function workspacePackages(
  workspaceDir: string
): Map<string, WorkspacePackage> {
  const packagesDir = join(workspaceDir, 'packages');
  const packages = new Map<string, WorkspacePackage>();

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const dir = join(packagesDir, entry.name);
    const manifestPath = join(dir, 'package.json');
    try {
      const manifest = readJson<PackageManifest>(manifestPath);
      packages.set(manifest.name, { dir, manifest });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  return packages;
}

function toInput(
  path: string,
  packageDir: string,
  workspaceDir: string
): TypeGateInput {
  const absolute = isAbsolute(path) ? path : resolve(packageDir, path);
  const packageRelative = relative(packageDir, absolute);

  if (!packageRelative.startsWith(`..${sep}`) && !isAbsolute(packageRelative)) {
    return toPosix(packageRelative);
  }

  const workspaceRelative = relative(workspaceDir, absolute);
  if (
    workspaceRelative === '..' ||
    workspaceRelative.startsWith(`..${sep}`) ||
    isAbsolute(workspaceRelative)
  ) {
    throw new Error(`workspace 밖의 설정 입력이다: ${path}`);
  }

  return { pattern: toPosix(workspaceRelative), base: 'workspace' };
}

function includeInput(
  entry: string,
  packageDir: string,
  workspaceDir: string
): TypeGateInput {
  return toInput(includeToGlob(entry), packageDir, workspaceDir);
}

function extendedConfigInputs(
  configPath: string,
  packageDir: string,
  workspaceDir: string
): TypeGateInput[] {
  const inputs: TypeGateInput[] = [];
  const visited = new Set<string>();

  function visit(path: string) {
    const config = readJsonc<TsConfig>(path);
    const entries = Array.isArray(config.extends)
      ? config.extends
      : config.extends
        ? [config.extends]
        : [];

    for (const entry of entries) {
      if (!entry.startsWith('.') && !isAbsolute(entry)) {
        throw new Error(`package tsconfig extends는 지원하지 않는다: ${entry}`);
      }
      const resolved = resolve(
        join(path, '..'),
        extname(entry) ? entry : `${entry}.json`
      );
      if (visited.has(resolved)) continue;
      visited.add(resolved);
      inputs.push(toInput(resolved, packageDir, workspaceDir));
      visit(resolved);
    }
  }

  visit(configPath);
  return inputs;
}

function localConfigInputs(packageDir: string): string[] {
  const files = new Set(readdirSync(packageDir));
  const inputs: string[] = [];

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
    ...[...files].filter(name => /^tsconfig\..+\.json$/.test(name)).sort()
  );

  return inputs;
}

export function loadLibraryMetadata(packageDir: string): LibraryMetadata {
  const workspaceDir = resolve(packageDir, '../..');
  const manifest = readJson<PackageManifest>(join(packageDir, 'package.json'));
  const tsconfigPath = join(packageDir, 'tsconfig.json');
  const tsconfig = readJsonc<TsConfig>(tsconfigPath);
  const packages = workspacePackages(workspaceDir);
  const configInputs = localConfigInputs(packageDir);
  const typeGateInput: TypeGateInput[] = [
    { auto: true },
    ...(tsconfig.include ?? []).map(entry =>
      includeInput(entry, packageDir, workspaceDir)
    ),
    ...configInputs,
    'package.json',
    'tsconfig.json',
    ...extendedConfigInputs(tsconfigPath, packageDir, workspaceDir),
    { pattern: 'build-target.ts', base: 'workspace' },
    { pattern: 'tools/vite/**', base: 'workspace' },
  ];

  const dependencies = Object.keys({
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  }).filter(name => name !== manifest.name);

  for (const dependency of dependencies) {
    const workspacePackage = packages.get(dependency);
    const types =
      workspacePackage?.manifest.types ?? workspacePackage?.manifest.typings;
    if (!workspacePackage || !types?.includes('dist/')) continue;

    typeGateInput.push({
      pattern: `${toPosix(relative(workspaceDir, workspacePackage.dir))}/dist/**/*.d.ts`,
      base: 'workspace',
    });
  }
  typeGateInput.push('!**/*.tsbuildinfo');

  return {
    manifest,
    hasTest: configInputs.some(input => input.startsWith('vitest.config.')),
    typeGateInput,
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function createExternal(manifest: PackageManifest): RegExp | undefined {
  const dependencies = Object.keys({
    ...manifest.peerDependencies,
    ...manifest.dependencies,
  });
  if (!dependencies.length) return undefined;

  return new RegExp(
    `^(?:${dependencies.map(escapeRegExp).join('|')})(?:/.+)*$`
  );
}
