/**
 * Throws a TypeError naming the option, after the caller's own name, for a value
 * a drawing from outside the element does not take; no other key is ever read.
 *
 * @example
 * assertExportOption('toImage', typeof darkMode === 'boolean', 'darkMode', darkMode);
 */
export function assertExportOption(
  caller: string,
  valid: boolean,
  name: string,
  value: unknown
): void {
  if (!valid) {
    throw new TypeError(`${caller}: ${name} cannot be ${String(value)}`);
  }
}
