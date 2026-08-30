import { defineConfig } from '@vscode/test-cli';
import { readFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { engines } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
);

/** ^1.90.0 → 1.90.0, so the floor is never restated in two places. */
const minimumSupported = engines.vscode.replace(/^\D+/, '');

/**
 * VSCode opens its IPC socket inside --user-data-dir, and a unix socket path is
 * capped near 104 bytes, which the default directory beside this file already
 * exceeds. Each version gets its own, or the older run goes flaky.
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
