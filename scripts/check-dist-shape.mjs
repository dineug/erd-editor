#!/usr/bin/env node
// Dist shape gate for @dineug/erd-editor, wired as pnpm dist-shape after pnpm
// build: what the declarations export, what the two umd files define, the
// worker files' document stubs, and the one worker url spelling hosts rewrite.
import fs from 'node:fs';
import path from 'node:path';

import { edgesOf } from './check-peer-graph.mjs';
import { evaluateInHappyDom } from './happy-dom-realm.mjs';

const root = path.resolve(import.meta.dirname, '..');
const packageDir = path.join(root, 'packages', 'erd-editor');
const distDir = path.join(packageDir, 'dist');

const MISSING_OUTPUT =
  'Run: pnpm exec vp run --filter @dineug/erd-editor --fail-if-no-match build';

/** The two elements: the module each lives in, its entry, its umd build and the keys its global holds. */
const ELEMENTS = [
  {
    tag: 'erd-editor',
    className: 'ErdEditorElement',
    define: 'defineErdEditor',
    module: './components/erd-editor/ErdEditor',
    entry: 'erd-editor.d.ts',
    umd: 'erd-editor.umd.js',
    global: 'ErdEditor',
    keys: [
      'ErdEditorElement',
      'createKeyBindingMap',
      'defineErdEditor',
      'dictionaryRowChords',
      'setExportFileCallback',
      'setImportFileCallback',
    ],
    inlinesWorkers: true,
  },
  {
    tag: 'erd-viewer',
    className: 'ErdViewerElement',
    define: 'defineErdViewer',
    module: './components/erd-viewer/ErdViewer',
    entry: 'erd-viewer.d.ts',
    umd: 'erd-viewer.umd.js',
    global: 'ErdViewer',
    keys: ['ErdViewerElement', 'defineErdViewer'],
    inlinesWorkers: false,
  },
];

/** A SharedWorker's constructor, and the data url the umd build inlines a worker as. */
const INLINED_WORKER_MARKERS = [/new SharedWorker\(/, /data:text\/javascript;base64,/];

/** The two worker files that install a document stub, each read by name. */
const STUBBED_WORKERS = ['exportPng.shared-worker.js', 'elkLayout.shared-worker.js'];

/**
 * The stub's guard and the write it opens, in any quote, written out or as a
 * minifier writes it: an if on typeof document === "undefined" whose block
 * starts with Reflect.set(globalThis, "document", ...), or typeof document > "u" &&.
 */
const STUB =
  /typeof document\s*(?:===?\s*(["'`])undefined\1|>\s*(["'`])u\2)\s*(?:\)\s*\{|&&\s*\(?)\s*Reflect\.set\(globalThis,\s*(["'`])document\3/;

/** Every url worker, whatever its spelling. */
const ANY_URL_WORKER = /new (?:Shared)?Worker\(new URL\(/g;

/** The hosts that rewrite a url worker in this dist, each by a URL_WORKER pattern of its own. */
const WORKER_HOSTS = [
  'tools/vite/same-origin-worker.ts',
  'packages/obsidian-plugin/vite.config.ts',
];

const failures = [];
const passes = [];

function check(label, problems) {
  if (problems.length) {
    failures.push(label);
    console.log(`FAIL ${label}`);
    for (const problem of problems) console.log(`       ${problem}`);
  } else {
    passes.push(label);
    console.log(`pass ${label}`);
  }
}

function read(file) {
  if (!fs.existsSync(file)) {
    throw new Error(
      `Missing build output: ${path.relative(root, file)}. ${MISSING_OUTPUT}`
    );
  }
  return fs.readFileSync(file, 'utf8');
}

const escape = text => text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** The names a declaration file exports as values from one module, never by export type. */
function valueExportsFrom(dts, module) {
  const statement = new RegExp(
    `export\\s*\\{([^}]*)\\}\\s*from\\s*["']${escape(module)}(?:\\.js)?["']`,
    'g'
  );
  return [...dts.matchAll(statement)].flatMap(match =>
    match[1]
      .split(',')
      .map(name => name.trim())
      .filter(name => name && !name.startsWith('type '))
      .map(name => name.split(/\s+as\s+/).pop())
  );
}

/**
 * The declarations a consumer types the elements by: the root's value exports,
 * each element module's class, define function, tag and CustomElementClass
 * from this package, and each entry's re-export of that module.
 */
function checkDeclarations() {
  const index = read(path.join(distDir, 'index.d.ts'));

  for (const element of ELEMENTS) {
    const problems = [];
    const exported = valueExportsFrom(index, element.module);
    for (const name of [element.className, element.define]) {
      if (!exported.includes(name)) {
        problems.push(`index.d.ts exports no ${name} from ${element.module}`);
      }
    }

    const moduleFile = path.join(distDir, `${element.module}.d.ts`);
    const dts = read(moduleFile);
    const declarations = [
      new RegExp(
        `export declare const ${element.className}: CustomElementClass<${element.className}>`
      ),
      new RegExp(`export declare function ${element.define}\\(\\): void`),
      new RegExp(
        `interface HTMLElementTagNameMap\\s*\\{[^}]*["']${element.tag}["']\\s*:\\s*${element.className}\\s*;`
      ),
    ];
    for (const declaration of declarations) {
      if (!declaration.test(dts)) {
        problems.push(`${path.relative(distDir, moduleFile)} lacks ${declaration.source}`);
      }
    }

    const imported =
      /import\s*(?:type\s*)?\{[^}]*\bCustomElementClass\b[^}]*\}\s*from\s*["']([^"']+)["']/.exec(
        dts
      );
    if (!imported || !imported[1].startsWith('.')) {
      problems.push(
        `${path.relative(distDir, moduleFile)} takes CustomElementClass from ${imported?.[1] ?? 'nowhere'}, not a module of this package`
      );
    } else {
      const shape = read(
        path.join(path.dirname(moduleFile), `${imported[1]}.d.ts`)
      );
      if (!/new \(\): C;/.test(shape) || !/readonly observedAttributes: string\[\];/.test(shape)) {
        problems.push(`${imported[1]}.d.ts declares no structural CustomElementClass`);
      }
    }

    const entry = read(path.join(distDir, element.entry));
    const reexport = new RegExp(
      `export\\s*(?:type\\s*)?(?:\\{[^}]*\\}|\\*)\\s*from\\s*["']${escape(element.module)}(?:\\.js)?["']`
    );
    if (!reexport.test(entry)) {
      problems.push(
        `${element.entry} re-exports nothing from ${element.module}, so a consumer of that entry alone lacks the tag's type`
      );
    }

    check(`declarations of ${element.tag}`, problems);
  }
}

/**
 * Each umd file, run as a classic script on happy-dom: it defines its own tag
 * and no other and leaves exactly its keys on its global. Only the editor's
 * inlines the workers, which the viewer's graph never reaches.
 */
async function checkUmd() {
  for (const element of ELEMENTS) {
    const file = path.join(distDir, element.umd);
    const code = read(file);
    const result = await evaluateInHappyDom(file, { global: element.global });
    const problems = result.errors.map(error => `threw ${error}`);

    for (const other of ELEMENTS) {
      const want = other === element;
      if (result.defined[other.tag] !== want) {
        problems.push(`${other.tag} is ${want ? 'undefined' : 'defined'}`);
      }
    }
    if (JSON.stringify(result.keys) !== JSON.stringify(element.keys)) {
      problems.push(
        `window.${element.global} holds ${JSON.stringify(result.keys)}, expected ${JSON.stringify(element.keys)}`
      );
    }
    for (const marker of INLINED_WORKER_MARKERS) {
      if (marker.test(code) !== element.inlinesWorkers) {
        problems.push(
          `${element.umd} ${element.inlinesWorkers ? 'lacks' : 'holds'} ${marker.source}`
        );
      }
    }
    check(`umd build ${element.umd}`, problems);
    for (const message of result.consoleErrors) {
      console.log(`       console.error: ${message.split('\n')[0]}`);
    }
  }
}

/**
 * The worker files that need a document stub carry it; where is not checked.
 * The export worker imports Konva as a package, which runs before its own
 * code, and the ELK worker imports comlink alone and elkjs later by import().
 */
function checkStubs() {
  for (const name of STUBBED_WORKERS) {
    const code = read(path.join(distDir, 'workers', name));
    const problems = STUB.test(code)
      ? []
      : ['no Reflect.set(globalThis, "document", ...) behind a typeof guard'];
    check(`document stub in workers/${name}`, problems);
  }
}

/** A host's URL_WORKER, read from its source as the regular expression literal it is. */
function hostPattern(file) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  const literal = /const URL_WORKER =\s*\/((?:\\.|[^/\\\n])+)\/([a-z]*);/.exec(
    text
  );
  if (!literal) throw new Error(`${file} declares no URL_WORKER literal`);
  const flags = literal[2].includes('g') ? literal[2] : `${literal[2]}g`;
  return { file, pattern: new RegExp(literal[1], flags) };
}

/**
 * Every url worker a script of an exports entry reaches is spelled the way
 * both hosts rewrite, each url names a file, and those files are exactly the
 * SharedWorker files of dist/workers.
 */
function checkWorkerUrls() {
  const manifest = JSON.parse(read(path.join(packageDir, 'package.json')));
  const hosts = WORKER_HOSTS.map(hostPattern);
  const files = new Set();
  const targets = new Set();
  const problems = [];

  for (const target of Object.values(manifest.exports)) {
    const entry = path.join(packageDir, typeof target === 'string' ? target : target.default);
    const graph = edgesOf(entry);
    for (const file of graph.files) files.add(file);
    for (const edge of graph.edges) {
      if (edge.kind === 'worker') targets.add(edge.to);
    }
  }

  let workers = 0;
  for (const file of files) {
    const code = fs.readFileSync(file, 'utf8');
    const count = code.match(ANY_URL_WORKER)?.length ?? 0;
    workers += count;
    if (!count) continue;
    const name = path.relative(distDir, file);
    for (const host of hosts) {
      const matches = [...code.matchAll(host.pattern)];
      if (matches.length !== count) {
        problems.push(
          `${host.file} rewrites ${matches.length} of the ${count} url workers in ${name}`
        );
      }
      for (const match of matches) {
        const url = path.resolve(path.dirname(file), match[2]);
        if (!fs.existsSync(url)) {
          problems.push(`${name} names ${match[2]}, which is not a file`);
        }
      }
    }
  }

  const built = fs
    .readdirSync(path.join(distDir, 'workers'))
    .filter(name => name.endsWith('.shared-worker.js'))
    .map(name => path.join(distDir, 'workers', name))
    .sort();
  const named = [...targets].sort();
  if (!workers) problems.push('no exports entry reaches a url worker');
  if (JSON.stringify(named) !== JSON.stringify(built)) {
    problems.push(
      `the urls name [${named.map(file => path.relative(distDir, file)).join(', ')}], dist/workers holds [${built.map(file => path.relative(distDir, file)).join(', ')}]`
    );
  }

  check(`worker urls (${workers} in ${files.size} files)`, problems);
}

async function main(argv) {
  if (argv[0] === '--help' || argv[0] === '-h') {
    console.log(`Usage: node scripts/check-dist-shape.mjs

  Reads packages/erd-editor/dist after pnpm build and exits 1 when a check
  fails: the declarations of both elements, both umd builds run on happy-dom,
  the document stubs of the two workers that need one, and the url workers.`);
    return 0;
  }
  if (argv.length) {
    console.error(`Unknown argument: ${argv[0]}`);
    return 2;
  }

  checkDeclarations();
  await checkUmd();
  checkStubs();
  checkWorkerUrls();

  if (failures.length) {
    console.log(`Dist shape: FAIL (${failures.length} of ${failures.length + passes.length})`);
    return 1;
  }
  console.log(`Dist shape: pass (${passes.length} checks)`);
  return 0;
}

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
