/**
 * The extensions /gdrive opens, the ones the VS Code extension registers too,
 * longest first, so that a.erd.json reads as .erd.json and not as .json.
 */
export const DRIVE_EXTENSIONS = ['.vuerd.json', '.erd.json', '.vuerd', '.erd'];

/** What a new file and an import are saved as. */
export const NEW_FILE_EXTENSION = '.erd.json';
export const NEW_FILE_MIME_TYPE = 'application/json';

const UNTITLED = 'Untitled';

export type DriveFileName = {
  base: string;
  /** As the file spells it, so a rename keeps .ERD as .ERD. */
  extension: string;
};

/** The name split at the extension /gdrive knows it by, or null for any other file. */
export function splitDriveFileName(name: string): DriveFileName | null {
  const lower = name.toLowerCase();
  const extension = DRIVE_EXTENSIONS.find(known => lower.endsWith(known));
  if (!extension) return null;

  const index = name.length - extension.length;
  return { base: name.slice(0, index), extension: name.slice(index) };
}

export function isDriveDocumentName(name: string): boolean {
  return splitDriveFileName(name) !== null;
}

/** What someone typed, without the extension they may have typed along with it. */
function toBaseName(input: string): string {
  const trimmed = input.trim();
  return (splitDriveFileName(trimmed)?.base ?? trimmed).trim();
}

/** A new file's name: orders, orders.erd and orders.erd.json all become orders.erd.json. */
export function toNewFileName(input: string): string {
  return `${toBaseName(input) || UNTITLED}${NEW_FILE_EXTENSION}`;
}

/**
 * A rename changes the part before the extension only, and keeps the file's
 * own extension whatever the new name ends in. Null when nothing is left.
 */
export function renameKeepingExtension(
  currentName: string,
  input: string
): string | null {
  const base = toBaseName(input);
  if (!base) return null;
  const extension =
    splitDriveFileName(currentName)?.extension ?? NEW_FILE_EXTENSION;
  return `${base}${extension}`;
}

/** The name "Download my changes" saves under, the local app's .erd. */
export function toDownloadFileName(name: string): string {
  return `${toBaseName(name) || UNTITLED}.erd`;
}
