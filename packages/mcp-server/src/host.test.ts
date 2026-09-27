import { describe, expect, it } from 'vite-plus/test';

import { capitalize, hostWords } from '@/hub/host';

describe('hostWords', () => {
  it('names VS Code with its extension and the setting that turns its hub on', () => {
    expect(hostWords('vscode')).toEqual({
      theWindow: 'the VS Code window',
      aWindow: 'a VS Code window',
      thatWindow: 'that window',
      addOn: 'extension',
      enableHub:
        'Trust the workspace and turn on the dineug.erd-editor.agentHub.enabled setting, or reload the window, then call again.',
      hubGoneRemedy:
        'Reload that window, or close it to edit the file directly.',
      unreachableRemedy: 'reload that window or check the ERD Editor extension',
      unsavedReason:
        'the editor kept it unsaved, as VS Code does when the file changed on disk',
    });
  });

  it('names Obsidian with its plugin and the plugin setting, never the VS Code one', () => {
    const words = hostWords('obsidian');

    expect(words).toEqual({
      theWindow: 'the Obsidian window',
      aWindow: 'an Obsidian window',
      thatWindow: 'that window',
      addOn: 'plugin',
      enableHub:
        "Turn on the ERD Editor plugin's coding-agent setting, or reload Obsidian, then call again.",
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or close that window to edit the file directly.',
      unreachableRemedy: 'reload that window or check the ERD Editor plugin',
      unsavedReason:
        'the editor kept it unsaved, as VS Code does when the file changed on disk',
    });
    expect(words.enableHub).not.toContain('dineug.erd-editor.agentHub');
    // A reload keeps the pid and the plugin off, so it cannot free the document.
    expect(words.hubGoneRemedy).not.toContain('Reload');
  });

  it('names a JetBrains IDE as one IDE, never a window, with its settings page and a restart', () => {
    const words = hostWords('intellij');

    expect(words).toEqual({
      theWindow: 'the JetBrains IDE',
      aWindow: 'a JetBrains IDE',
      thatWindow: 'that IDE',
      addOn: 'plugin',
      enableHub:
        'Turn on Coding agents under Settings | Tools | ERD Editor in that IDE, or restart that IDE if it is on, then call again.',
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or quit that IDE to edit the file directly.',
      unreachableRemedy: 'restart that IDE or check the ERD Editor plugin',
      unsavedReason:
        'the IDE could not write it, such as while a dialog was open or when the file cannot be written',
    });
    for (const text of Object.values(words)) {
      expect(text).not.toContain('window');
    }
    expect(words.enableHub).not.toContain('dineug.erd-editor.agentHub');
    // Closing a project window keeps the pid, so neither a reload nor a close frees the document.
    expect(words.hubGoneRemedy).not.toContain('Reload');
    expect(words.unreachableRemedy).not.toContain('reload');
  });

  it.each([
    ['zed', 'the zed window', 'a zed window'],
    ['  fleet ', 'the fleet window', 'a fleet window'],
    [' obsidian', 'the Obsidian window', 'an Obsidian window'],
    [' intellij\n', 'the JetBrains IDE', 'a JetBrains IDE'],
  ])(
    'names the ide %j as its lock spells it, trimmed',
    (ide, theWindow, aWindow) => {
      expect(hostWords(ide)).toMatchObject({ theWindow, aWindow });
    }
  );

  it('gives a host it does not know a remedy that fits any editor', () => {
    expect(hostWords('zed')).toMatchObject({
      thatWindow: 'that window',
      addOn: 'extension or plugin',
      enableHub:
        'Turn on the ERD Editor hub in that editor, or reload the window, then call again.',
      hubGoneRemedy:
        'Reload that window, or close it to edit the file directly.',
      unreachableRemedy:
        'reload that window or check the ERD Editor extension or plugin',
      unsavedReason:
        'the editor kept it unsaved, as VS Code does when the file changed on disk',
    });
  });

  it.each(['', '  '])(
    'reads the blank ide %j as an editor window, article included',
    ide => {
      expect(hostWords(ide)).toMatchObject({
        theWindow: 'an editor window',
        aWindow: 'an editor window',
        thatWindow: 'that window',
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
