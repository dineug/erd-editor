import { describe, expect, it } from 'vite-plus/test';

import { capitalize, hostWords } from '@/hub/host';

describe('hostWords', () => {
  it('names VS Code with its extension and the setting that turns its hub on', () => {
    expect(hostWords('vscode')).toEqual({
      theWindow: 'the VS Code window',
      aWindow: 'a VS Code window',
      addOn: 'extension',
      enableHub:
        'Trust the workspace and turn on the dineug.erd-editor.agentHub.enabled setting, or reload the window, then call again.',
      hubGoneRemedy:
        'Reload that window, or close it to edit the file directly.',
    });
  });

  it('names Obsidian with its plugin and the plugin setting, never the VS Code one', () => {
    const words = hostWords('obsidian');

    expect(words).toEqual({
      theWindow: 'the Obsidian window',
      aWindow: 'an Obsidian window',
      addOn: 'plugin',
      enableHub:
        "Turn on the ERD Editor plugin's coding-agent setting, or reload Obsidian, then call again.",
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or close that window to edit the file directly.',
    });
    expect(words.enableHub).not.toContain('dineug.erd-editor.agentHub');
    // A reload keeps the pid and the plugin off, so it cannot free the document.
    expect(words.hubGoneRemedy).not.toContain('Reload');
  });

  it.each([
    ['zed', 'the zed window', 'a zed window'],
    ['  intellij ', 'the intellij window', 'an intellij window'],
    [' obsidian', 'the Obsidian window', 'an Obsidian window'],
  ])(
    'names the ide %j as its lock spells it, trimmed',
    (ide, theWindow, aWindow) => {
      expect(hostWords(ide)).toMatchObject({ theWindow, aWindow });
    }
  );

  it('gives a host it does not know a remedy that fits any editor', () => {
    expect(hostWords('zed')).toMatchObject({
      addOn: 'extension or plugin',
      enableHub:
        'Turn on the ERD Editor hub in that editor, or reload the window, then call again.',
      hubGoneRemedy:
        'Reload that window, or close it to edit the file directly.',
    });
  });

  it.each(['', '  '])(
    'reads the blank ide %j as an editor window, article included',
    ide => {
      expect(hostWords(ide)).toMatchObject({
        theWindow: 'an editor window',
        aWindow: 'an editor window',
        addOn: 'extension or plugin',
      });
    }
  );
});

describe('capitalize', () => {
  it('raises the first letter only', () => {
    expect(capitalize('the VS Code window')).toBe('The VS Code window');
    expect(capitalize('an editor window')).toBe('An editor window');
    expect(capitalize('')).toBe('');
  });
});
