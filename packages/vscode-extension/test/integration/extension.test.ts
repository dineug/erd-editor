import * as assert from 'assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

const EXTENSION_ID = 'dineug.vuerd-vscode';
const VIEW_TYPE = 'editor.erd';
const THEME_SECTION = 'dineug.erd-editor.theme';
const FIXTURE_FILE = 'sample.erd';

// This file is executed as out/test/integration/extension.test.js.
const PACKAGE_ROOT = path.resolve(__dirname, '..', '..', '..');
const FIXTURE_WORKSPACE = path.join(
  PACKAGE_ROOT,
  'test',
  'fixtures',
  'workspace'
);

const COMMANDS = [
  'vuerd.showSource',
  'vuerd.showEditor',
  'vuerd.showSourceToSide',
  'vuerd.showEditorToSide',
];

const THEME_KEYS = ['appearance', 'grayColor', 'accentColor'];

type ManifestMenuItem = {
  command?: string;
  alt?: string;
  submenu?: string;
};

function getExtension(): vscode.Extension<unknown> {
  const extension = vscode.extensions.getExtension<unknown>(EXTENSION_ID);
  if (!extension) {
    throw new Error(
      `${EXTENSION_ID} is not installed in the Extension Host — check --extensionDevelopmentPath`
    );
  }
  return extension;
}

/** Idempotent: VSCode activates an extension at most once per host. */
async function activateExtension(): Promise<vscode.Extension<unknown>> {
  const extension = getExtension();
  await extension.activate();
  return extension;
}

/** The manifest as *VSCode parsed it*, not as readFileSync would see it. */
function manifest(): any {
  return getExtension().packageJSON;
}

function contributedCommandIds(): string[] {
  return manifest().contributes.commands.map(
    (command: { command: string }) => command.command
  );
}

/** Every command id a contributed menu can invoke, alt actions included. */
function menuCommandIds(): string[] {
  const menus: Record<string, ManifestMenuItem[]> =
    manifest().contributes.menus;

  return Object.values(menus)
    .flat()
    .flatMap(item => [item.command, item.alt])
    .filter((id): id is string => typeof id === 'string');
}

function workspaceContainsGlobs(): string[] {
  const prefix = 'workspaceContains:';

  return manifest()
    .activationEvents.filter((event: string) => event.startsWith(prefix))
    .map((event: string) => event.slice(prefix.length));
}

function registeredCommands(): Thenable<string[]> {
  return vscode.commands.getCommands(true);
}

function getThemeConfiguration(): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration(THEME_SECTION);
}

function getContributedThemeProperty(name: string): any {
  const [configuration] = manifest().contributes.configuration;
  return configuration.properties[`${THEME_SECTION}.${name}`];
}

/**
 * Both sides of every path comparison go through realpathSync: the host
 * reports resolved paths, and a symlinked checkout would otherwise fail on a
 * difference that means nothing.
 */
function realPath(target: string): string {
  return fs.realpathSync(target);
}

/**
 * Leaves the fixture workspace with no theme override, so the default specs
 * cannot be masked by a value this suite or a crashed run wrote. Sequential on
 * purpose: concurrent writes to one settings file race each other.
 */
async function clearThemeOverrides(): Promise<void> {
  for (const key of THEME_KEYS) {
    const config = getThemeConfiguration();
    if (config.inspect(key)?.workspaceValue === undefined) continue;
    await config.update(key, undefined, vscode.ConfigurationTarget.Workspace);
  }
}

describe('vuerd-vscode in the Extension Host', () => {
  describe('activation', () => {
    it('loads this working tree under the id the marketplace publishes', () => {
      const extension = getExtension();

      assert.strictEqual(extension.id, EXTENSION_ID);
      // Guards against the suite silently passing against an installed
      // marketplace build instead of the --extensionDevelopmentPath one.
      assert.strictEqual(
        realPath(extension.extensionPath),
        realPath(PACKAGE_ROOT)
      );
    });

    it('activates without throwing', async () => {
      const extension = getExtension();

      await extension.activate();

      // isActive after an awaited activate() is the API's own guarantee, so the
      // load-bearing part is that the promise resolves at all. What activate
      // did is asserted by the command specs below.
      assert.strictEqual(extension.isActive, true);
    });

    it('opened the fixture workspace that holds the .erd file', () => {
      const folders = vscode.workspace.workspaceFolders ?? [];

      assert.strictEqual(folders.length, 1);
      assert.strictEqual(
        realPath(folders[0].uri.fsPath),
        realPath(FIXTURE_WORKSPACE)
      );
      assert.ok(fs.existsSync(path.join(FIXTURE_WORKSPACE, FIXTURE_FILE)));
    });

    it('declares an activation glob that VSCode itself matches against sample.erd', async () => {
      const globs = workspaceContainsGlobs();
      assert.ok(
        globs.length > 0,
        'without a workspaceContains event the extension stays dormant until a file is opened by hand'
      );

      // findFiles runs the workbench's own glob engine, so this fails for any
      // rewrite of the pattern that stops covering .erd files — which a string
      // comparison against the manifest could never notice.
      const matches = await Promise.all(
        globs.map(glob => vscode.workspace.findFiles(glob))
      );
      const names = matches.flat().map(uri => path.basename(uri.fsPath));

      assert.ok(
        names.includes(FIXTURE_FILE),
        `none of ${JSON.stringify(globs)} matches ${FIXTURE_FILE}`
      );
    });
  });

  describe('contributed commands', () => {
    before(async () => {
      await activateExtension();
    });

    it('registers a live handler for every command the manifest contributes', async () => {
      const contributed = contributedCommandIds();
      // Pinned so an emptied contributes.commands cannot make the loop below
      // pass by iterating over nothing.
      assert.deepStrictEqual([...contributed].sort(), [...COMMANDS].sort());

      const registered = await registeredCommands();

      for (const command of contributed) {
        assert.ok(
          registered.includes(command),
          `${command} is contributed but never registered — the editor title action would silently do nothing`
        );
      }
    });

    it('contributes every vuerd command it registers, so none is unreachable', async () => {
      const registered = await registeredCommands();
      const ours = registered.filter(command => command.startsWith('vuerd.'));

      assert.deepStrictEqual(ours.sort(), [...COMMANDS].sort());
    });

    it('points every menu entry — alt actions included — at a registered command', async () => {
      const referenced = menuCommandIds();
      // The editor/title entries carry their "to the side" variant in alt;
      // if the extractor ever stopped reading it this spec would go vacuous.
      assert.ok(referenced.includes('vuerd.showEditorToSide'));
      assert.ok(referenced.includes('vuerd.showSourceToSide'));

      const registered = await registeredCommands();

      for (const command of referenced) {
        assert.ok(
          registered.includes(command),
          `a contributed menu points at ${command}, which nothing registers`
        );
      }
    });
  });

  describe('custom editor contribution', () => {
    it('claims the erd/vuerd filenames for editor.erd at default priority', () => {
      const { customEditors } = manifest().contributes;
      const customEditor = customEditors.find(
        (editor: { viewType: string }) => editor.viewType === VIEW_TYPE
      );

      assert.ok(customEditor, `no custom editor declared for ${VIEW_TYPE}`);
      assert.deepStrictEqual(
        customEditor.selector
          .map(
            (selector: { filenamePattern: string }) => selector.filenamePattern
          )
          .sort(),
        ['*.erd', '*.erd.json', '*.vuerd', '*.vuerd.json']
      );
      // Anything other than "default" would hand a double-clicked .erd file to
      // the text editor, and vuerd.showEditor would become the only way in.
      assert.strictEqual(customEditor.priority, 'default');
    });
  });

  describe('contributed configuration', () => {
    before(async () => {
      await activateExtension();
      await clearThemeOverrides();
    });

    afterEach(async () => {
      await clearThemeOverrides();
    });

    it('resolves appearance to the documented "dark" default', () => {
      const config = getThemeConfiguration();

      // defaultValue proves VSCode registered the contributed property;
      // get proves that is also what getTheme() resolves to at runtime.
      assert.strictEqual(config.inspect('appearance')?.defaultValue, 'dark');
      assert.strictEqual(config.get('appearance'), 'dark');
    });

    it('resolves grayColor to the documented "slate" default', () => {
      const config = getThemeConfiguration();

      assert.strictEqual(config.inspect('grayColor')?.defaultValue, 'slate');
      assert.strictEqual(config.get('grayColor'), 'slate');
    });

    it('resolves accentColor to the documented "indigo" default', () => {
      const config = getThemeConfiguration();

      assert.strictEqual(config.inspect('accentColor')?.defaultValue, 'indigo');
      assert.strictEqual(config.get('accentColor'), 'indigo');
    });

    it('surfaces a workspace-scoped write as workspaceValue, which is the signal saveTheme scopes on', async () => {
      assert.ok(
        getContributedThemeProperty('accentColor').enum.includes('ruby'),
        'ruby must stay a legal accentColor or the update below writes an invalid value'
      );

      await getThemeConfiguration().update(
        'accentColor',
        'ruby',
        vscode.ConfigurationTarget.Workspace
      );

      // A WorkspaceConfiguration is a snapshot, so the handle used for the
      // write cannot see it — getTheme() re-reads for the same reason.
      const config = getThemeConfiguration();
      assert.strictEqual(config.get('accentColor'), 'ruby');
      // getConfigurationScope in src/configuration.ts branches on exactly
      // this, so a later save has to stay in the workspace file.
      assert.strictEqual(config.inspect('accentColor')?.workspaceValue, 'ruby');
      // The manifest default survives underneath the override, which is what
      // makes resetting the setting to undefined a real reset.
      assert.strictEqual(config.inspect('accentColor')?.defaultValue, 'indigo');
    });

    it('associates .erd and .vuerd with json, so the source view is not plain text', () => {
      const config = vscode.workspace.getConfiguration('files');
      const associations = config.get<Record<string, string>>('associations');

      // Contributed via contributes.configurationDefaults, so it has to land
      // in the *default* layer rather than in any user or workspace file.
      assert.strictEqual(
        config.inspect<Record<string, string>>('associations')?.defaultValue?.[
          '*.erd'
        ],
        'json'
      );
      assert.strictEqual(associations?.['*.erd'], 'json');
      assert.strictEqual(associations?.['*.vuerd'], 'json');
    });
  });
});
