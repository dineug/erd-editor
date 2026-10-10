import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vite-plus/test';

import { VIEW_TYPE } from '@/constants/viewType';

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
  it('leaves every file it claims to the text editor in a git revision, so Source Control diffs JSON lines', () => {
    const patterns = packageJson.contributes.customEditors.flatMap(editor =>
      editor.selector.map(({ filenamePattern }) => filenamePattern)
    );

    expect(
      packageJson.contributes.configurationDefaults[
        'workbench.editorAssociations'
      ]
    ).toEqual(
      Object.fromEntries(
        patterns.map(pattern => [`git:/**/${pattern}`, 'default'])
      )
    );
  });
});
