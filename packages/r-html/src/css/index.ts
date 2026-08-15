import { compile } from '@/css/compile';
import { collectDiagnostics, Diagnostic } from '@/css/diagnostics';
import { emit } from '@/css/emit';
import { FlatRule, flatten, Middleware } from '@/css/flatten';
import { toIdentifier } from '@/css/hash';
import { SCOPE } from '@/css/selector';

export type { CompileOptions } from '@/css/compile';
export { compile } from '@/css/compile';
export type {
  Diagnostic,
  DiagnosticCode,
  DiagnosticSeverity,
  DiagnosticsOptions,
} from '@/css/diagnostics';
export { collectDiagnostics } from '@/css/diagnostics';
export type { EmitOptions } from '@/css/emit';
export { emit } from '@/css/emit';
export type { FlatRule, FlattenOptions, Middleware } from '@/css/flatten';
export { flatten } from '@/css/flatten';
export { fnv1a32, toIdentifier } from '@/css/hash';
export { isShadowBoundary, SCOPE, substituteScope } from '@/css/selector';

/**
 * `scoped` seeds `rules` with the sentinel; `global` seeds it empty, the way
 * stylis' own `compile()` does.
 */
export type CompileMode = 'scoped' | 'global';

export type CompileToRulesOptions = {
  /** Defaults to `scoped`. */
  mode?: CompileMode;
  plugins?: Middleware[];
  /** Diagnostics are only collected when this is on; the array is empty otherwise. */
  dev?: boolean;
};

export type CompiledRules = {
  /** Sentinel still in place. */
  rules: FlatRule[];
  /** Serialized with the sentinel — the hash input. */
  canonicalText: string;
  identifier: string;
  /** Serialized with the sentinel replaced by `.${identifier}` — this is what gets adopted. */
  cssText: string;
  diagnostics: Diagnostic[];
};

const NO_DIAGNOSTICS: Diagnostic[] = [];

/** `source` must already have every interpolation substituted; markers never reach the compiler. */
export function compileToRules(
  source: string,
  options: CompileToRulesOptions = {}
): CompiledRules {
  const scoped = options.mode !== 'global';
  // A fresh array per call: stylis hands this exact array to the wrapper rulesets it synthesizes
  // inside conditional at-rules, so it must never be shared between compiles.
  const rules = scoped ? [SCOPE] : [''];

  const elements = compile(source, { rules });
  const flattened = flatten(elements, { rules, plugins: options.plugins });

  // The identifier hashes the rules and the rules carry the identifier, so the hash has to be
  // taken against the sentinel and only the second `emit()` can substitute it in.
  const canonicalText = emit(flattened);
  const identifier = toIdentifier(canonicalText);
  const cssText = emit(flattened, { scope: `.${identifier}` });

  return {
    rules: flattened,
    canonicalText,
    identifier,
    cssText,
    diagnostics: options.dev
      ? collectDiagnostics(elements, flattened, { source, scoped })
      : NO_DIAGNOSTICS,
  };
}
