import { Element } from 'stylis';

import {
  AtRuleElement,
  childrenOf,
  declarationsOf,
  declarationText,
  isAtRule,
  isConditionalAtRule,
  isDeclaration,
  isRuleset,
  RulesetElement,
  stepsOf,
} from '@/css/element';
import { emit } from '@/css/emit';

export type FlatRule = {
  /** Enclosing conditional at-rule preludes, outermost first. */
  conditions: string[];
  selectors: string[];
  prelude?: string;
  declarations: string[];
  body?: string;
};

/** Return the rule to keep or replace it, or an array to expand it — `[]` discards. */
export type Middleware = (rule: FlatRule) => FlatRule | FlatRule[];

export type FlattenOptions = {
  /** The same parent selector list the tree was compiled with (`[SCOPE]`, or `['']` for global). */
  rules: string[];
  plugins?: Middleware[];
};

const NO_CONDITIONS: string[] = [];

const isNotEmpty = (value: string) => value.length > 0;

export function flatten(
  elements: Element[],
  options: FlattenOptions
): FlatRule[] {
  const collected: FlatRule[] = [];
  walk(elements, NO_CONDITIONS, options.rules, collected);

  const piped = (options.plugins ?? []).reduce<FlatRule[]>(
    (rules, plugin) => rules.flatMap(rule => plugin(rule)),
    collected
  );

  // Re-run after the plugins: a middleware can empty a rule. A no-op on `walk()`'s own output.
  return piped.filter(isEmittable);
}

function isEmittable(rule: FlatRule): boolean {
  const hasHead = rule.selectors.length > 0 || rule.prelude !== undefined;
  const hasBody = rule.declarations.length > 0 || Boolean(rule.body);

  return hasHead && hasBody;
}

function walk(
  elements: Element[],
  conditions: string[],
  rules: string[],
  collected: FlatRule[]
): void {
  const start = collected.length;
  const rootDeclarations: string[] = [];

  for (const element of elements) {
    if (isDeclaration(element)) {
      rootDeclarations.push(declarationText(element));
    } else if (isRuleset(element)) {
      appendStyleRule(element, conditions, collected);
    } else if (isAtRule(element)) {
      appendAtRule(element, conditions, rules, collected);
    }
  }

  if (rootDeclarations.length === 0) return;

  // Bare declarations have no selector of their own and inherit `rules`, merged to the front of
  // their condition context. In global mode there is nothing to give them.
  const selectors = rules.filter(isNotEmpty);
  if (selectors.length === 0) return;

  collected.splice(start, 0, {
    conditions,
    selectors,
    declarations: rootDeclarations,
  });
}

function appendStyleRule(
  element: RulesetElement,
  conditions: string[],
  collected: FlatRule[]
): void {
  // Discarding an empty selector list is RULESET-only: `@font-face` and `@page` carry empty
  // props too and must survive.
  const selectors = element.props.filter(isNotEmpty);
  if (selectors.length === 0) return;

  const declarations = declarationsOf(element);
  if (declarations.length === 0) return;

  collected.push({ conditions, selectors, declarations });
}

function appendAtRule(
  element: AtRuleElement,
  conditions: string[],
  rules: string[],
  collected: FlatRule[]
): void {
  const children = childrenOf(element);
  // Statement at-rules — `@import` / `@charset` / `@namespace` / `@layer a;` — are unsupported:
  // happy-dom throws away the whole sheet, and one sheet per template means one component's
  // styles. `diagnostics.ts` reports them.
  if (children.length === 0) return;

  if (isConditionalAtRule(element.type)) {
    const nested: FlatRule[] = [];
    walk(children, [...conditions, element.value], rules, nested);
    // Discards run bottom-up: an at-rule whose entire body was discarded goes with it.
    if (nested.length === 0) return;

    for (const rule of nested) collected.push(rule);
    return;
  }

  const steps = stepsOf(element);
  if (steps.length > 0) {
    // Steps arrive unscoped and are serialized here; `emit()` never looks inside `body` again.
    const stepRules: FlatRule[] = [];
    for (const step of steps) appendStyleRule(step, NO_CONDITIONS, stepRules);
    const body = emit(stepRules);
    if (body) {
      collected.push({
        conditions,
        selectors: [],
        prelude: element.value,
        declarations: [],
        body,
      });
    }
    return;
  }

  const declarations = declarationsOf(element);
  if (declarations.length === 0) return;

  collected.push({
    conditions,
    selectors: [],
    prelude: element.value,
    declarations,
  });
}
