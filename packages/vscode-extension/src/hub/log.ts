/** The hub reports to console.warn only: a failing hub must never stop an editor from opening. */
export function warn(...details: unknown[]): void {
  console.warn('[erd-editor hub]', ...details);
}
