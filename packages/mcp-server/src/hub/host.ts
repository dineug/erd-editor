import { ideDisplayName } from '@dineug/erd-editor-agent-hub';

/**
 * The words a refusal or a note names an editor with, read off the ide of its
 * lock, since the lock is all a session has once a connection failed or closed.
 */
export type HostWords = {
  /** The editor as a sentence names it: the VS Code window, the JetBrains IDE, or an editor window when the lock names none. */
  readonly theWindow: string;
  /** An editor the agent hears of first: a VS Code window, an Obsidian window, a JetBrains IDE. */
  readonly aWindow: string;
  /** That editor named again later in a sentence: that window, or that IDE. */
  readonly thatWindow: string;
  /** What the ERD Editor is inside that editor. */
  readonly addOn: 'extension' | 'plugin' | 'extension or plugin';
  /** Whole sentences that tell the user how to turn a refusing window's hub back on. */
  readonly enableHub: string;
  /** What frees a document whose window still runs with its lock and connection gone. */
  readonly hubGoneRemedy: string;
  /** What to try when the hub a lock advertises accepts no connection, as a clause. */
  readonly unreachableRemedy: string;
  /** Why the editor may have kept a document unsaved, as a clause. */
  readonly unsavedReason: string;
};

/**
 * A window serves one workspace, and its hub is reached again by reloading it;
 * an IDE is one process serving every project it has open, with its own remedy.
 */
type HostRemedy = Pick<
  HostWords,
  'addOn' | 'enableHub' | 'hubGoneRemedy' | 'unsavedReason'
> &
  (
    | { readonly place: 'window' }
    | { readonly place: 'ide'; readonly unreachableRemedy: string }
  );

const RELOAD_OR_CLOSE =
  'Reload that window, or close it to edit the file directly.';

const KEPT_UNSAVED =
  'the editor kept it unsaved, as VS Code does when the file changed on disk';

/** The hosts whose remedies are known, by the ide their hubs write. */
const REMEDIES: ReadonlyMap<string, HostRemedy> = new Map([
  [
    'vscode',
    {
      place: 'window',
      addOn: 'extension',
      enableHub:
        'Trust the workspace and turn on the dineug.erd-editor.agentHub.enabled setting, or reload the window, then call again.',
      hubGoneRemedy: RELOAD_OR_CLOSE,
      unsavedReason: KEPT_UNSAVED,
    },
  ],
  [
    'obsidian',
    {
      place: 'window',
      addOn: 'plugin',
      enableHub:
        "Turn on the ERD Editor plugin's coding-agent setting, or reload Obsidian, then call again.",
      // A reload keeps the pid and a turned-off plugin stays off, so only these free it.
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or close that window to edit the file directly.',
      unsavedReason: KEPT_UNSAVED,
    },
  ],
  [
    'intellij',
    {
      place: 'ide',
      addOn: 'plugin',
      // Blocked also means the hub failed to start, which a restart retries.
      enableHub:
        'Turn on Coding agents under Settings | Tools | ERD Editor in that IDE, or restart that IDE if it is on, then call again.',
      // Closing a project window keeps the pid, so only these free the document.
      hubGoneRemedy:
        'Turn the ERD Editor plugin back on, or quit that IDE to edit the file directly.',
      unreachableRemedy: 'restart that IDE or check the ERD Editor plugin',
      unsavedReason:
        'the IDE could not write it, such as while a dialog was open or when the file cannot be written',
    },
  ],
]);

const OTHER_HOST: HostRemedy = {
  place: 'window',
  addOn: 'extension or plugin',
  enableHub:
    'Turn on the ERD Editor hub in that editor, or reload the window, then call again.',
  hubGoneRemedy: RELOAD_OR_CLOSE,
  unsavedReason: KEPT_UNSAVED,
};

/** The words for the editor a lock's ide names; see ideDisplayName for the names. */
export function hostWords(ide: string): HostWords {
  const name = ideDisplayName(ide);
  const host = REMEDIES.get(ide.trim()) ?? OTHER_HOST;
  const { addOn, enableHub, hubGoneRemedy, unsavedReason } = host;
  const remedy = { addOn, enableHub, hubGoneRemedy, unsavedReason };
  const article = /^[aeiou]/i.test(name) ? 'an' : 'a';
  // One IDE process serves every project it has open, so it is no window.
  if (host.place === 'ide') {
    return {
      theWindow: `the ${name}`,
      aWindow: `${article} ${name}`,
      thatWindow: 'that IDE',
      ...remedy,
      unreachableRemedy: host.unreachableRemedy,
    };
  }
  const windowWords = {
    thatWindow: 'that window',
    ...remedy,
    unreachableRemedy: `reload that window or check the ERD Editor ${addOn}`,
  };
  // A blank ide reads as an editor, which already carries its article.
  if (ide.trim() === '') {
    return {
      theWindow: `${name} window`,
      aWindow: `${name} window`,
      ...windowWords,
    };
  }
  return {
    theWindow: `the ${name} window`,
    aWindow: `${article} ${name} window`,
    ...windowWords,
  };
}

/** The text with its first letter in upper case, for words that open a sentence. */
export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
