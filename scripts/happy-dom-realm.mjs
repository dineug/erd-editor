// Evaluates one script on happy-dom globals in a child process of its own, so
// each one meets a fresh realm and an empty custom element registry, and says
// what it defined. check-consumer-bundles.mjs and check-dist-shape.mjs use it.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const SELF = fileURLToPath(import.meta.url);
const TAGS = ['erd-editor', 'erd-viewer'];

/**
 * How long a realm may run before it is stopped and its case fails, far past
 * any bundle the gates evaluate, so a script that never settles cannot hold CI.
 */
export const REALM_TIMEOUT_MS = 60_000;

/**
 * Globals the child takes from happy-dom even where Node has its own, since a
 * custom event or an abort crossing between the two implementations fails.
 */
const FORCED = new Set([
  'Event',
  'EventTarget',
  'CustomEvent',
  'MessageEvent',
  'KeyboardEvent',
  'DOMException',
  'navigator',
  'AbortController',
  'AbortSignal',
]);

/** Names the window object owns that must stay Node's, or point back at it. */
const SKIPPED = new Set([
  'window',
  'self',
  'top',
  'parent',
  'globalThis',
  'global',
  'undefined',
  'NaN',
  'Infinity',
]);

/**
 * Evaluates file in a child: as a module, or as a classic script when global
 * names the object a UMD build assigns, whose keys are then reported too.
 * Resolves to the defines, the tags defined, the probe and the errors.
 *
 * @param scenario A module whose before() runs on the fresh realm ahead of the
 * file and whose after() runs once it has, its result reported as scenario.
 */
export function evaluateInHappyDom(file, { global, scenario } = {}) {
  const args = [
    SELF,
    file,
    ...(global ? ['--global', global] : []),
    ...(scenario ? ['--scenario', scenario] : []),
  ];
  const failed = error => ({
    defines: [],
    defined: {},
    keys: null,
    probe: null,
    scenario: null,
    consoleErrors: [],
    errors: [error],
  });

  return new Promise(resolve => {
    const child = spawn(process.execPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, REALM_TIMEOUT_MS);
    child.stdout.on('data', chunk => (stdout += chunk));
    child.stderr.on('data', chunk => (stderr += chunk));
    child.on('close', code => {
      clearTimeout(timer);
      if (timedOut) {
        resolve(
          failed(
            `the evaluation had not settled after ${REALM_TIMEOUT_MS / 1000} s and was killed`
          )
        );
        return;
      }
      const last = stdout.trim().split('\n').pop() ?? '';
      try {
        resolve(JSON.parse(last));
      } catch {
        resolve(
          failed(`the evaluation exited ${code}: ${stderr.slice(-800)}`)
        );
      }
    });
  });
}

/** Copies a happy-dom window onto the global object, as Vitest's environment does. */
async function installHappyDom() {
  const { GlobalWindow } = await import('happy-dom');
  const window = new GlobalWindow({
    url: 'http://localhost/',
    settings: { disableErrorCapturing: true },
  });

  for (const key of Object.getOwnPropertyNames(window)) {
    if (SKIPPED.has(key)) continue;
    if (key in globalThis && !FORCED.has(key)) continue;
    const value = window[key];
    const bound =
      typeof value === 'function' && key[0] !== key[0].toUpperCase()
        ? value.bind(window)
        : value;
    Object.defineProperty(globalThis, key, {
      value: bound,
      configurable: true,
      writable: true,
    });
  }
  for (const key of ['window', 'self', 'top', 'parent']) {
    Object.defineProperty(globalThis, key, {
      value: globalThis,
      configurable: true,
      writable: true,
    });
  }
}

const describe = error =>
  `${error?.name ?? 'Error'}: ${String(error?.message ?? error).split('\n')[0]}`;

async function evaluate(file, global, scenarioFile) {
  const result = {
    defines: [],
    defined: {},
    keys: null,
    probe: null,
    scenario: null,
    consoleErrors: [],
    errors: [],
  };
  console.error = (...args) =>
    result.consoleErrors.push(args.map(String).join(' '));
  process.on('uncaughtException', error => result.errors.push(describe(error)));
  process.on('unhandledRejection', error =>
    result.errors.push(describe(error))
  );

  await installHappyDom();
  const scenario = scenarioFile
    ? await import(pathToFileURL(path.resolve(scenarioFile)).href)
    : null;
  await scenario?.before?.();
  const define = customElements.define.bind(customElements);
  customElements.define = (name, constructor, options) => {
    result.defines.push(name);
    return define(name, constructor, options);
  };

  try {
    if (global) {
      vm.runInThisContext(fs.readFileSync(file, 'utf8'), { filename: file });
    } else {
      await import(pathToFileURL(file).href);
    }
  } catch (error) {
    result.errors.push(describe(error));
  }
  // One macrotask turn, so a rejection the evaluation left unhandled reports.
  await new Promise(resolve => setImmediate(resolve));

  for (const tag of TAGS) {
    result.defined[tag] = customElements.get(tag) !== undefined;
  }
  if (global && globalThis[global]) {
    result.keys = Object.keys(globalThis[global]).sort();
  }
  result.probe = globalThis.__consumerProbe ?? null;
  if (scenario?.after) {
    try {
      result.scenario = await scenario.after();
    } catch (error) {
      result.errors.push(describe(error));
    }
  }
  // Exits once the line is written: a pipe is asynchronous off Linux, and
  // happy-dom's timers would otherwise keep the child alive.
  process.stdout.write(`${JSON.stringify(result)}\n`, () => process.exit(0));
}

const realpathOf = file => fs.realpathSync(path.resolve(file));

if (
  process.argv[1] !== undefined &&
  realpathOf(process.argv[1]) === realpathOf(SELF)
) {
  const [file, ...rest] = process.argv.slice(2);
  const option = name => {
    const index = rest.indexOf(name);
    return index === -1 ? undefined : rest[index + 1];
  };
  await evaluate(file, option('--global'), option('--scenario'));
}
