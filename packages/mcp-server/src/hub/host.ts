import { ideDisplayName } from '@dineug/erd-editor-agent-hub';

/**
 * The words a refusal or a note names an editor with, read off the ide of its
 * lock, since the lock is all a session has once a connection failed or closed.
 */
export type HostWords = {
  /** The window as a sentence names it: the VS Code window, or an editor window when the lock names none. */
  readonly theWindow: string;
  /** A window the agent hears of first: a VS Code window, an Obsidian window. */
  readonly aWindow: string;
  /** What the ERD Editor is inside that editor. */
  readonly addOn: 'extension' | 'plugin' | 'extension or plugin';
  /** Whole sentences that tell the user how to turn a refusing window's hub back on. */
  readonly enableHub: string;
  /** What frees a document whose window still runs with its lock and connection gone. */
  readonly hubGoneRemedy: string;
};

type HostRemedy = Pick<HostWords, 'addOn' | 'enableHub' | 'hubGoneRemedy'>;

const RELOAD_OR_CLOSE =
  'Reload that window, or close it to edit the file directly.';

/** The hosts whose remedies are known, by the ide their hubs write. */
const REMEDIES: ReadonlyMap<string, HostRemedy> = new Map([
  [
    'vscode',
    {
      addOn: 'extension',
      enableHub:
        'Trust the workspace and turn on the dineug.erd-editor.agentHub.enabled setting, or reload the window, then call again.',
      hubGoneRemedy: RELOAD_OR_CLOSE,
    },
  ],
  [
    'obsidian',
    {
      addOn: 'plugin',
      enableHub:
        "Turn on the ERD Editor plugin's coding-agent setting, or reload Obsidian, then call again.",
      // A reload keeps the pid and a turned-off plugin stays off, so only these free it.
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or close that window to edit the file directly.',
    },
  ],
]);

const OTHER_HOST: HostRemedy = {
  addOn: 'extension or plugin',
  enableHub:
    'Turn on the ERD Editor hub in that editor, or reload the window, then call again.',
  hubGoneRemedy: RELOAD_OR_CLOSE,
};

/** The words for the editor a lock's ide names; see ideDisplayName for the names. */
export function hostWords(ide: string): HostWords {
  const name = ideDisplayName(ide);
  const remedy = REMEDIES.get(ide.trim()) ?? OTHER_HOST;
  // A blank ide reads as an editor, which already carries its article.
  if (ide.trim() === '') {
    return {
      theWindow: `${name} window`,
      aWindow: `${name} window`,
      ...remedy,
    };
  }
  const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
  return {
    theWindow: `the ${name} window`,
    aWindow: `${article} ${name} window`,
    ...remedy,
  };
}

/** The text with its first letter in upper case, for words that open a sentence. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
