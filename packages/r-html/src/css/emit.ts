// Type-only, and therefore erased: flatten.ts imports emit() back for @keyframes bodies.
import type { FlatRule } from '@/css/flatten';
import { substituteScope } from '@/css/selector';

export type EmitOptions = {
  /** Omit to get the canonical text, which is what gets hashed. */
  scope?: string;
};

// No whitespace and no reordering: the output is the hash input, so it has to be byte-stable.
export function emit(rules: FlatRule[], options: EmitOptions = {}): string {
  let output = '';
  let open: string[] = [];

  for (const rule of rules) {
    // Only the previous rule is compared, so adjacent rules sharing a condition prefix merge
    // into one block while non-adjacent ones stay separate, in source order.
    const { conditions } = rule;
    let common = 0;
    while (
      common < open.length &&
      common < conditions.length &&
      open[common] === conditions[common]
    ) {
      common++;
    }

    for (let i = common; i < open.length; i++) output += '}';
    for (let i = common; i < conditions.length; i++)
      output += `${conditions[i]}{`;

    open = conditions;
    output += emitRule(rule, options.scope);
  }

  for (let i = 0; i < open.length; i++) output += '}';

  return output;
}

function emitRule(rule: FlatRule, scope?: string): string {
  // body is already serialized and already unscoped — @keyframes steps must not be rewritten.
  if (rule.body !== undefined) return `${rule.prelude}{${rule.body}}`;

  const head = rule.prelude ?? emitSelectors(rule.selectors, scope);

  return `${head}{${rule.declarations.join(';')};}`;
}

function emitSelectors(selectors: string[], scope?: string): string {
  return (
    scope === undefined
      ? selectors
      : selectors.map(selector => substituteScope(selector, scope))
  ).join(',');
}
