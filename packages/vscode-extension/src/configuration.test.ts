import { readFileSync } from 'node:fs';

import {
  AccentColor,
  Appearance,
  GrayColor,
  ThemeOptions,
} from '@dineug/erd-editor-vscode-bridge';
import { beforeEach, describe, expect, it } from 'vite-plus/test';

import { getTheme, saveTheme } from '@/configuration';

import {
  ConfigurationInspect,
  ConfigurationTarget,
  createWorkspaceConfiguration,
  MockWorkspaceConfiguration,
  resetVscodeMock,
  workspace,
} from '../test/mocks/vscode';

const SECTION = 'dineug.erd-editor.theme';

const theme: ThemeOptions = {
  appearance: Appearance.light,
  grayColor: GrayColor.olive,
  accentColor: AccentColor.jade,
};

function arrangeConfiguration(options?: {
  values?: Record<string, unknown>;
  /**
   * Per-scope values only. The real `inspect` always reports the full setting
   * id back as `key`, so it is filled in here rather than at each call site.
   */
  inspect?: Record<string, Omit<ConfigurationInspect, 'key'> | undefined>;
}) {
  const inspect: Record<string, ConfigurationInspect | undefined> =
    Object.fromEntries(
      Object.entries(options?.inspect ?? {}).map(
        ([key, scopes]): [string, ConfigurationInspect | undefined] => [
          key,
          scopes && { key: `${SECTION}.${key}`, ...scopes },
        ]
      )
    );

  const config = createWorkspaceConfiguration({
    values: options?.values,
    inspect,
  });
  workspace.getConfiguration.mockReturnValue(config);
  return config;
}

type UpdateCall = [key: string, value: unknown, target: ConfigurationTarget];

/**
 * The stub's `update` is declared without parameters, so its recorded calls
 * need re-typing before a spec can read the scope argument back out.
 */
function updateCalls(config: MockWorkspaceConfiguration): UpdateCall[] {
  return config.update.mock.calls as unknown as UpdateCall[];
}

type ManifestSetting = { default?: unknown; enum?: string[] };

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
);

/**
 * `contributes.configuration` may be a single object or an array of them, and
 * each entry carries its own `properties` map keyed by full setting id.
 */
const manifestSettings: Record<string, ManifestSetting> = Object.fromEntries(
  [manifest.contributes?.configuration ?? []]
    .flat()
    .flatMap((entry: any) => Object.entries<any>(entry.properties ?? {}))
);

function manifestSetting(key: string): ManifestSetting {
  const setting = manifestSettings[`${SECTION}.${key}`];
  // A missing id means the extension reads and writes a setting VSCode was
  // never told about: no default, no validation, nothing in the settings UI.
  if (!setting) {
    throw new Error(`package.json contributes no "${SECTION}.${key}"`);
  }
  return setting;
}

describe('configuration', () => {
  beforeEach(() => {
    resetVscodeMock();
  });

  describe('getTheme', () => {
    it('reads the theme out of the dineug.erd-editor.theme section', () => {
      arrangeConfiguration();

      getTheme();

      expect(workspace.getConfiguration).toHaveBeenCalledTimes(1);
      expect(workspace.getConfiguration).toHaveBeenCalledWith(SECTION);
    });

    it('falls back to dark / slate / indigo when nothing is stored', () => {
      const config = arrangeConfiguration();

      expect(getTheme()).toEqual({
        appearance: Appearance.dark,
        grayColor: GrayColor.slate,
        accentColor: AccentColor.indigo,
      });
      // The defaults are handed to `get` per key, which is what makes a
      // partially configured theme fill in the rest rather than yield undefined.
      expect(config.get.mock.calls).toEqual([
        ['appearance', Appearance.dark],
        ['grayColor', GrayColor.slate],
        ['accentColor', AccentColor.indigo],
      ]);
    });

    it('prefers the stored values over the defaults', () => {
      arrangeConfiguration({
        values: {
          appearance: Appearance.light,
          grayColor: GrayColor.sand,
          accentColor: AccentColor.tomato,
        },
      });

      expect(getTheme()).toEqual({
        appearance: Appearance.light,
        grayColor: GrayColor.sand,
        accentColor: AccentColor.tomato,
      });
    });

    it('resolves each key on its own — one stored key does not drop the other defaults', () => {
      arrangeConfiguration({ values: { accentColor: AccentColor.mint } });

      expect(getTheme()).toEqual({
        appearance: Appearance.dark,
        grayColor: GrayColor.slate,
        accentColor: AccentColor.mint,
      });
    });

    it('uses the same defaults package.json contributes — a drift silently reskins the editor', () => {
      arrangeConfiguration();

      expect(getTheme()).toEqual({
        appearance: manifestSetting('appearance').default,
        grayColor: manifestSetting('grayColor').default,
        accentColor: manifestSetting('accentColor').default,
      });
    });

    it("hands 'auto' back untouched — the manifest offers it but Appearance has no such member", () => {
      // `ThemeOptions['appearance']` is `Appearance | 'auto'`, so the value the
      // settings UI offers is deliberately outside the `Appearance` map.
      expect(manifestSetting('appearance').enum).toContain('auto');
      arrangeConfiguration({ values: { appearance: 'auto' } });

      expect(getTheme().appearance).toBe('auto');
    });
  });

  describe('saveTheme', () => {
    it('writes all three keys to the dineug.erd-editor.theme section through one handle', () => {
      const config = arrangeConfiguration();

      saveTheme(theme);

      expect(workspace.getConfiguration).toHaveBeenCalledTimes(1);
      expect(workspace.getConfiguration).toHaveBeenCalledWith(SECTION);
      expect(updateCalls(config).map(([key, value]) => [key, value])).toEqual([
        ['appearance', Appearance.light],
        ['grayColor', GrayColor.olive],
        ['accentColor', AccentColor.jade],
      ]);
    });

    it('inspects every key it writes, since the scope is decided per key', () => {
      const config = arrangeConfiguration();

      saveTheme(theme);

      expect(config.inspect.mock.calls).toEqual([
        ['appearance'],
        ['grayColor'],
        ['accentColor'],
      ]);
    });

    it('writes to Global when the setting is not set at any scope', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: { defaultValue: Appearance.dark },
          grayColor: { defaultValue: GrayColor.slate },
          accentColor: { defaultValue: AccentColor.indigo },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config).map(([, , target]) => target)).toEqual([
        ConfigurationTarget.Global,
        ConfigurationTarget.Global,
        ConfigurationTarget.Global,
      ]);
    });

    it('writes to Global when inspect knows nothing about the key at all', () => {
      const config = arrangeConfiguration({
        inspect: { appearance: undefined },
      });

      saveTheme(theme);

      expect(updateCalls(config)).toEqual([
        ['appearance', Appearance.light, ConfigurationTarget.Global],
        ['grayColor', GrayColor.olive, ConfigurationTarget.Global],
        ['accentColor', AccentColor.jade, ConfigurationTarget.Global],
      ]);
    });

    it('ignores globalValue when picking a scope — a user setting still writes to Global', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: {
            defaultValue: Appearance.dark,
            globalValue: Appearance.dark,
          },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config)[0]).toEqual([
        'appearance',
        Appearance.light,
        ConfigurationTarget.Global,
      ]);
    });

    it('writes to Workspace when the key is set in the workspace file', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: { workspaceValue: Appearance.dark },
          grayColor: { workspaceValue: GrayColor.sage },
          accentColor: { workspaceValue: AccentColor.ruby },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config).map(([, , target]) => target)).toEqual([
        ConfigurationTarget.Workspace,
        ConfigurationTarget.Workspace,
        ConfigurationTarget.Workspace,
      ]);
    });

    it('writes to WorkspaceFolder when the key is set in the folder file', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: { workspaceFolderValue: Appearance.dark },
          grayColor: { workspaceFolderValue: GrayColor.sage },
          accentColor: { workspaceFolderValue: AccentColor.ruby },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config).map(([, , target]) => target)).toEqual([
        ConfigurationTarget.WorkspaceFolder,
        ConfigurationTarget.WorkspaceFolder,
        ConfigurationTarget.WorkspaceFolder,
      ]);
    });

    it('prefers WorkspaceFolder over Workspace when the key is set in both', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: {
            workspaceValue: Appearance.dark,
            workspaceFolderValue: Appearance.light,
          },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config)[0]).toEqual([
        'appearance',
        Appearance.light,
        ConfigurationTarget.WorkspaceFolder,
      ]);
    });

    it('scopes each key independently — a workspace-scoped grayColor leaves the other two on Global', () => {
      const config = arrangeConfiguration({
        inspect: {
          grayColor: { workspaceValue: GrayColor.sage },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config)).toEqual([
        ['appearance', Appearance.light, ConfigurationTarget.Global],
        ['grayColor', GrayColor.olive, ConfigurationTarget.Workspace],
        ['accentColor', AccentColor.jade, ConfigurationTarget.Global],
      ]);
    });

    it('mixes all three scopes in one save when each key lives somewhere else', () => {
      const config = arrangeConfiguration({
        inspect: {
          appearance: { globalValue: Appearance.dark },
          grayColor: { workspaceValue: GrayColor.sage },
          accentColor: { workspaceFolderValue: AccentColor.ruby },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config).map(([, , target]) => target)).toEqual([
        ConfigurationTarget.Global,
        ConfigurationTarget.Workspace,
        ConfigurationTarget.WorkspaceFolder,
      ]);
    });

    it('treats a falsy-but-present value as set — scope is decided on presence, not truthiness', () => {
      // A setting deliberately stored as `''` (or `false`, or `0`) at a narrower
      // scope is still set. Redirecting its write to Global would leave the
      // narrower value in place, silently overriding what was just saved.
      const config = arrangeConfiguration({
        inspect: {
          appearance: { workspaceFolderValue: '' },
          grayColor: { workspaceValue: '' },
        },
      });

      saveTheme(theme);

      expect(updateCalls(config).map(([, , target]) => target)).toEqual([
        ConfigurationTarget.WorkspaceFolder,
        ConfigurationTarget.Workspace,
        ConfigurationTarget.Global,
      ]);
    });

    it('writes values the manifest declares for those setting ids', () => {
      const config = arrangeConfiguration();

      saveTheme(theme);

      // Nothing validates the payload on the way out, so the ids the writes
      // target have to be contributed and the values have to be in their enum.
      expect(updateCalls(config)).toHaveLength(3);
      for (const [key, value] of updateCalls(config)) {
        expect(manifestSetting(key).enum).toContain(value);
      }
    });

    it('cannot write a theme the manifest would reject — every bridge value is contributed', () => {
      expect([...(manifestSetting('appearance').enum ?? [])].sort()).toEqual(
        // `ThemeOptions['appearance']` is `Appearance | 'auto'`.
        [...Object.values(Appearance), 'auto'].sort()
      );
      expect([...(manifestSetting('grayColor').enum ?? [])].sort()).toEqual(
        Object.values(GrayColor).sort()
      );
      expect([...(manifestSetting('accentColor').enum ?? [])].sort()).toEqual(
        Object.values(AccentColor).sort()
      );
    });

    it('round-trips through getTheme — the keys it writes are the keys getTheme reads', () => {
      const saved = arrangeConfiguration();

      saveTheme(theme);

      // Replay exactly what was written as the stored settings. A key renamed
      // on one side only leaves the other side reading its default back.
      expect(updateCalls(saved)).toHaveLength(3);
      const reloaded = arrangeConfiguration({
        values: Object.fromEntries(
          updateCalls(saved).map(([key, value]) => [key, value])
        ),
      });

      expect(getTheme()).toEqual(theme);
      expect(reloaded.get.mock.calls.map(([key]) => key)).toEqual(
        updateCalls(saved).map(([key]) => key)
      );
    });

    it('returns undefined instead of a promise — the three writes are fire-and-forget', () => {
      const config = arrangeConfiguration();

      expect(saveTheme(theme)).toBeUndefined();
      expect(config.update).toHaveBeenCalledTimes(3);
    });

    it('swallows a rejected write and still attempts the remaining keys', () => {
      const config = arrangeConfiguration();
      config.update.mockImplementation(() => {
        const rejected = Promise.reject(new Error('settings.json is readonly'));
        // `saveTheme` drops the thenable, so the spec owns the rejection
        // handler; without one Node reports it as unhandled.
        rejected.catch(() => undefined);
        return rejected;
      });

      // A failed write reaches neither the caller nor the user.
      expect(() => saveTheme(theme)).not.toThrow();
      expect(updateCalls(config).map(([key]) => key)).toEqual([
        'appearance',
        'grayColor',
        'accentColor',
      ]);
    });
  });
});
