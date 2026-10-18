import { existsSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

export interface JsxLibraryOptions {
  konvaImportSource: string;
}

/** The one export of the r-html plugin package this factory calls. */
export interface RHtmlPluginModule {
  rHtml: (options: {
    jsx: JsxLibraryOptions;
    refresh: false;
  }) => PluginOption[];
}

export type RHtmlPluginLoader = (
  packageDir: string
) => Promise<RHtmlPluginModule>;

interface LibraryConfigOptions {
  dts: (options: DtsPluginOptions) => PluginOption;
  /**
   * Compiles .tsx, in the page and its workers, through r-html's JSX plugin,
   * which the package must list as a devDependency, with hot refresh off;
   * konvaImportSource names the module a konva-host file's tags come from.
   */
  jsx?: JsxLibraryOptions;
  minify?: false;
  /**
   * A library that runs on Node: its builtins stay imports, bare or with the
   * node: prefix, and it targets the Node floor its engines field declares.
   * Without it a builtin resolves to an empty browser stub and still builds.
   */
  node?: true;
  /**
   * One output module per source file, mirrored under dist. For a library
   * another bundler consumes, that bundler then prunes at file granularity,
   * which its sideEffects: false manifest is what allows.
   */
  preserveModules?: true;
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

/** A build step a package runs after the standard one, such as its script-tag build. */
export interface LibraryTaskOptions {
  build?: string[];
}

export function createLibraryTasks(
  packageDir: string,
  options: LibraryTaskOptions = {}
) {
  const metadata = loadLibraryMetadata(packageDir);
  const tasks: NonNullable<NonNullable<ViteUserConfig['run']>['tasks']> = {
    build: {
      command: ['tsc --noEmit', 'vp build', ...(options.build ?? [])],
      dependsOn,
      cache: {
        input: [...metadata.typeGateInput, '!dist/**'],
        output: ['dist/**'],
      },
    },
  };

  if (metadata.hasTest) {
    tasks.test = {
      command: ['tsc --noEmit', 'vp test run'],
      dependsOn,
      cache: {
        input: [...metadata.typeGateInput],
      },
    };
  }

  return tasks;
}

/**
 * Resolves the r-html plugin from the package being built, since the root links
 * no workspace package and so cannot resolve it for a library.
 */
async function loadRHtmlPlugin(packageDir: string): Promise<RHtmlPluginModule> {
  const entry = createRequire(join(packageDir, 'package.json')).resolve(
    '@dineug/vite-plugin-r-html'
  );
  return import(pathToFileURL(entry).href);
}

export function createLibraryConfig(
  packageDir: string,
  options: LibraryConfigOptions,
  loadJsxPlugin: RHtmlPluginLoader = loadRHtmlPlugin
): ViteUserConfig {
  const { jsx } = options;
  const metadata = loadLibraryMetadata(packageDir);
  const external = createExternal(
    metadata.manifest,
    options.node ? builtinModules : []
  );
  const output = options.preserveModules
    ? { preserveModules: true, preserveModulesRoot: join(packageDir, 'src') }
    : undefined;
  const rolldownOptions =
    external || output
      ? { ...(external ? { external } : {}), ...(output ? { output } : {}) }
      : undefined;
  const tsconfigBuild = join(packageDir, 'tsconfig.build.json');
  const jsxPlugins = (): PluginOption[] =>
    jsx
      ? [
          loadJsxPlugin(packageDir).then(({ rHtml }) =>
            rHtml({ jsx, refresh: false })
          ),
        ]
      : [];
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
      target: options.node ? 'node22' : BROWSER_TARGET,
      ...(options.minify === false ? { minify: false } : {}),
      lib: {
        entry: ['./src/index.ts'],
        formats: ['es'],
      },
      ...(rolldownOptions ? { rolldownOptions } : {}),
    },
    resolve: {
      alias: {
        '@': join(packageDir, 'src'),
      },
    },
    // Task metadata is read before the workspace builds the plugin, and
    // lazyPlugins runs nothing then, so the loader waits for a real build.
    plugins: lazyPlugins(() => [
      ...jsxPlugins(),
      options.dts(dtsOptions),
      ...(options.workers ? [libraryWorkerUrls()] : []),
    ]),
    ...(options.server ? { server: options.server } : {}),
    // A worker entry is bundled by a pass of its own that inherits no plugin,
    // so a jsx library hands that pass the r-html plugin as well.
    ...(options.workers
      ? {
          worker: {
            ...createWorkerOptions(external),
            ...(jsx ? { plugins: () => [lazyPlugins(jsxPlugins)] } : {}),
          },
        }
      : {}),
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
