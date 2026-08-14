import { defineConfig } from '@vscode/test-cli';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Integration suite: downloads a real VSCode, launches it with this folder as
 * `--extensionDevelopmentPath`, and runs the Mocha specs inside the Extension
 * Host — so `require('vscode')` is the genuine API, not `test/mocks/vscode.ts`.
 *
 * `files` points at compiled output because the Extension Host has no TS
 * loader; the `e2e` script runs `tsc -p tsconfig.integration.json` first.
 *
 * The extension's `main` is `./dist/extension`, and `Editor#buildHtmlForWebview`
 * reads `public/index.html` (emitted by `@dineug/erd-editor-vscode-webview`), so
 * both must be built before this runs — hence the `nx build` in CI.
 *
 * Two configurations run: the current stable build, and the oldest VSCode the
 * manifest claims to support. The second is the one that catches an API used
 * before it existed, or a Node builtin the older host does not ship — declaring
 * `engines.vscode` is a promise nothing else here verifies.
 */

const { engines } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
);

/** `^1.90.0` → `1.90.0`, so the floor is never restated in two places. */
const minimumSupported = engines.vscode.replace(/^\D+/, '');

/**
 * VSCode opens its main IPC socket inside `--user-data-dir`, and a unix socket
 * path is capped at 104 bytes on macOS (108 on Linux). `@vscode/test-electron`
 * defaults the directory to `.vscode-test/user-data` beside this file
 * (`out/util.js` only injects the flag when the args do not already carry it),
 * which puts the socket at 105 characters from a normal checkout and ~102 from
 * a GitHub Actions one — so the launch dies with `EINVAL` before a single test
 * runs. Parking it under the OS temp dir keeps it far short of the limit no
 * matter how deep the repository is cloned.
 *
 * Each version gets its own directory: VSCode migrates the profile it finds
 * there, and letting 1.90 and stable share one makes the older run flaky.
 */
function userDataDir(label) {
  const base =
    process.env.VSCODE_TEST_USER_DATA_DIR ??
    join(tmpdir(), 'vuerd-vscode-test');
  const dir = join(base, label);

  mkdirSync(dir, { recursive: true });
  return dir;
}

const shared = {
  files: 'out/test/integration/**/*.test.js',
  workspaceFolder: './test/fixtures/workspace',
  mocha: {
    ui: 'bdd',
    timeout: 30_000,
  },
};

export default defineConfig([
  {
    ...shared,
    label: 'stable',
    version: 'stable',
    launchArgs: [
      '--disable-extensions',
      '--disable-gpu',
      `--user-data-dir=${userDataDir('stable')}`,
    ],
  },
  {
    ...shared,
    label: 'minimum-supported',
    version: minimumSupported,
    launchArgs: [
      '--disable-extensions',
      '--disable-gpu',
      `--user-data-dir=${userDataDir(minimumSupported)}`,
    ],
  },
]);
