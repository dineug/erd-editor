/** A diagram file of the vault, the TFile main.ts hands over; it keeps its identity through a rename. */
export type VaultFile = { readonly path: string };

/** One ERD tab as the hub sees it, which ErdView implements. */
export interface HubTab {
  /** Takes an agent batch the way it takes another tab's edit: its shared store, then its replica. */
  receive(actions: unknown[]): void;
  /**
   * Writes the file through the tab's own save, now rather than on its timer.
   * True once the file holds what the tab shows, which includes there being
   * nothing to write; false when the write failed. Never rejects.
   */
  saveDocument(): Promise<boolean>;
  /** The text the file held when the tab last loaded or saved it, which a save compares against. */
  lastSaved(): string | null;
}

/** What a create found: nothing there, a file already there, or no folder to put it in. */
export type CreateOutcome = 'created' | 'exists' | 'noFolder';

/** The vault as the hub handler needs it, which main.ts implements with the Obsidian API. */
export interface HubVault {
  /** The absolute path of every file the vault lists, as its adapter spells it. */
  files(): readonly string[];
  /** Creates the file at an absolute path unless one is there; rejects only on a failure it cannot name. */
  create(path: string, data: string): Promise<CreateOutcome>;
  /**
   * Shows the file at an absolute path in an ERD tab without taking focus: a
   * tab already on it loads if it was deferred, or a background tab opens.
   * Rejects with the reason when the vault cannot.
   */
  open(path: string): Promise<void>;
}
