import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

import { VIEW_TYPE } from '@/constants/viewType';
import { READONLY_SCHEMES } from '@/hub/readonlyUri';

type PackageJson = {
  contributes: {
    customEditors: Array<{
      viewType: string;
      selector: Array<{ filenamePattern: string }>;
    }>;
    configurationDefaults: {
      'workbench.editorAssociations': Record<string, string>;
    };
  };
};

const packageJson: PackageJson = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')
);

describe('VIEW_TYPE', () => {
  it('is the literal id the extension registers its custom editor under', () => {
    expect(VIEW_TYPE).toBe('editor.erd');
  });

  it('matches contributes.customEditors[0].viewType — VSCode silently opens nothing when the two drift apart', () => {
    expect(packageJson.contributes.customEditors[0].viewType).toBe(VIEW_TYPE);
  });
});

describe('workbench.editorAssociations', () => {
  const associations =
    packageJson.contributes.configurationDefaults[
      'workbench.editorAssociations'
    ];
  const extensions = packageJson.contributes.customEditors
    .flatMap(editor => editor.selector)
    .map(({ filenamePattern }) => filenamePattern.replace(/^\*\./, ''));
  const fileExtensions = `{${extensions.join(',')}}`;
  const schemeOf = (key: string) =>
    key.slice(key.startsWith('{') ? 1 : 0, key.indexOf(':'));
  const schemes = new Set(Object.keys(associations).map(schemeOf));

  it('sends every file the custom editor claims to the text editor under each scheme it lists', () => {
    for (const [key, editor] of Object.entries(associations)) {
      const scheme = schemeOf(key);

      expect(editor).toBe('default');
      // A key without a slash is matched against the basename alone, so a
      // path with no leading slash needs the second alternative inside one.
      expect([
        `${scheme}:/**/*.${fileExtensions}`,
        `{${scheme}:/**/*,${scheme}:*}.${fileExtensions}`,
      ]).toContain(key);
    }
  });

  it('opens as text by default every read-only view the editor locks', () => {
    for (const scheme of READONLY_SCHEMES) {
      expect(schemes).toContain(scheme);
    }
  });

  it('leaves the files of a writable workspace to the custom editor', () => {
    for (const scheme of [
      'file',
      'untitled',
      'vscode-remote',
      'vscode-vfs',
      'vscode-userdata',
      'vscode-agent-host',
      'vsls',
    ]) {
      expect(schemes).not.toContain(scheme);
    }
  });
});
