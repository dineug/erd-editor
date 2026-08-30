import type { CompileMode, Diagnostic } from '@/css';

export type CSSDiagnosticContext = {
  /** The fully substituted source the finding was made against. */
  source: string;
  /** The content hash of the template — an opaque handle, and a class only when mode is scoped. */
  identifier: string;
  mode: CompileMode;
};

export type CSSDiagnosticHandler = (
  diagnostic: Diagnostic,
  context: CSSDiagnosticContext
) => void;

/**
 * Read lazily on every compile, so a page can turn diagnostics on with an inline <script> before
 * the bundle loads and never has to care where r-html sits in the module graph. true installs
 * consoleDiagnosticHandler; a function is used as the handler directly.
 */
const AMBIENT_FLAG = '__RHTML_CSS_DIAGNOSTICS__';

const location = ({ line, column }: Diagnostic): string =>
  line === undefined ? '' : ` (${line}:${column ?? 1})`;

export const consoleDiagnosticHandler: CSSDiagnosticHandler = (
  diagnostic,
  context
) => {
  const tag = context.mode === 'global' ? 'css.global' : 'css';
  const message = `[r-html] ${tag} ${context.identifier}${location(diagnostic)} ${diagnostic.code}: ${diagnostic.message}`;

  diagnostic.severity === 'error'
    ? console.error(message)
    : console.warn(message);
};

/** undefined means nothing called setCSSDiagnostics, so the ambient flag decides. */
let override: CSSDiagnosticHandler | null | undefined;

function resolveHandler(): CSSDiagnosticHandler | null {
  if (override !== undefined) return override;

  const ambient = Reflect.get(globalThis, AMBIENT_FLAG);
  if (!ambient) return null;

  return typeof ambient === 'function'
    ? (ambient as CSSDiagnosticHandler)
    : consoleDiagnosticHandler;
}

/**
 * Turns diagnostic collection on, which is not free: true reports to the
 * console, a function reports to it, false is off whatever the ambient flag
 * says, and null forgets the override. Each compilation reports once.
 */
export function setCSSDiagnostics(
  value: boolean | CSSDiagnosticHandler | null
): void {
  if (value === null) {
    override = undefined;
    return;
  }

  override =
    value === true
      ? consoleDiagnosticHandler
      : typeof value === 'function'
        ? value
        : null;
}

export function isCSSDiagnosticsEnabled(): boolean {
  return resolveHandler() !== null;
}

export function reportCSSDiagnostics(
  diagnostics: readonly Diagnostic[],
  context: CSSDiagnosticContext
): void {
  if (diagnostics.length === 0) return;

  const handler = resolveHandler();
  if (!handler) return;

  for (const diagnostic of diagnostics) handler(diagnostic, context);
}
