import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  defineConfig,
  lazyPlugins,
  type PluginOption,
  type ViteUserConfig,
} from 'vite-plus';

import { BROWSER_TARGET } from '../../build-target.ts';
import { createExternal, loadLibraryMetadata } from './package-metadata.ts';
import { libraryWorkerUrls } from './worker-url.ts';

export interface DtsPluginOptions {
  tsconfigPath?: string;
  compilerOptions: { declarationMap: true };
}

interface LibraryConfigOptions {
  dts: (options: DtsPluginOptions) => PluginOption;
  format?: 'es' | 'cjs';
  minify?: false;
  server?: ViteUserConfig['server'];
  workers?: true;
}

/**
 * The worker half of a library build: an es module per worker under an
 * unhashed workers/ name, external where the page is, so a consumer's bundler
 * builds it as an entry of its own and a host that must inline it can name it.
 */
export function createWorkerOptions(
  external?: RegExp
): NonNullable<ViteUserConfig['worker']> {
  return {
    format: 'es',
    rolldownOptions: {
      ...(external ? { external } : {}),
      output: {
        entryFileNames: 'workers/[name].js',
        chunkFileNames: 'workers/[name]-[hash].js',
      },
    },
  };
}

const dependsOn: Array<{
  task: string;
  from: Array<'dependencies' | 'devDependencies' | 'peerDependencies'>;
}> = [
  {
    task: 'build',
    from: ['dependencies', 'devDependencies', 'peerDependencies'],
  },
];

export function createLibraryTasks(packageDir: string) {
  const metadata = loadLibraryMetadata(packageDir);
  const tasks: NonNullable<NonNullable<ViteUserConfig['run']>['tasks']> = {
    build: {
      command: ['tsc --noEmit', 'vp build'],
      dependsOn,
      input: [...metadata.typeGateInput, '!dist/**'],
      output: ['dist/**'],
    },
  };

  if (metadata.hasTest) {
    tasks.test = {
      command: ['tsc --noEmit', 'vp test run'],
      dependsOn,
      input: [...metadata.typeGateInput],
    };
  }

  return tasks;
}

export function createLibraryConfig(
  packageDir: string,
  options: LibraryConfigOptions
): ViteUserConfig {
  const metadata = loadLibraryMetadata(packageDir);
  const external = createExternal(metadata.manifest);
  const rolldownOptions = external ? { external } : undefined;
  const tsconfigBuild = join(packageDir, 'tsconfig.build.json');
  const dtsOptions: DtsPluginOptions = {
    ...(existsSync(tsconfigBuild)
      ? { tsconfigPath: './tsconfig.build.json' }
      : {}),
    compilerOptions: { declarationMap: true },
  };

  return {
    run: {
      tasks: createLibraryTasks(packageDir),
    },
    build: {
      target: BROWSER_TARGET,
      ...(options.minify === false ? { minify: false } : {}),
      lib: {
        entry: ['./src/index.ts'],
        formats: [options.format ?? 'es'],
      },
      ...(rolldownOptions ? { rolldownOptions } : {}),
    },
    resolve: {
      alias: {
        '@': join(packageDir, 'src'),
      },
    },
    plugins: lazyPlugins(() => [
      options.dts(dtsOptions),
      ...(options.workers ? [libraryWorkerUrls()] : []),
    ]),
    ...(options.server ? { server: options.server } : {}),
    ...(options.workers ? { worker: createWorkerOptions(external) } : {}),
  };
}

export function defineLibraryConfig(
  configUrl: string,
  options: LibraryConfigOptions
) {
  return defineConfig(
    createLibraryConfig(dirname(fileURLToPath(configUrl)), options)
  );
}
