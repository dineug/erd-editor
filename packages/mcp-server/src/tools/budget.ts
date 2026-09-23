/**
 * The most characters one read answers. Claude Code sets a tool result over
 * 50,000 characters aside in a file, whatever the script, which an agent
 * without file tools cannot open, so a read stays a fifth under that.
 */
export const MAX_READ_CHARS = 40_000;

/** Whether a text fits in one read. */
export const fitsInRead = (text: string): boolean =>
  text.length <= MAX_READ_CHARS;
