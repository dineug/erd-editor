import { CHARSET, Element, IMPORT, LAYER, NAMESPACE } from 'stylis';

import {
  childrenOf,
  declarationsOf,
  isAtRule,
  isConditionalAtRule,
  isDeclaration,
  isRuleset,
  RulesetElement,
  stepsOf,
} from '@/css/element';
import { FlatRule } from '@/css/flatten';
import { isShadowBoundary, SCOPE } from '@/css/selector';

export type DiagnosticSeverity = 'error' | 'warning';

export type DiagnosticCode =
  | 'shadow-boundary'
  | 'implicit-descendant'
  | 'unsupported-at-rule'
  | 'import-after-rule'
  | 'duplicate-keyframes'
  | 'rule-without-selector'
  | 'scope-in-declaration'
  | 'unterminated-comment'
  | 'unterminated-string';

export type Diagnostic = {
  code: DiagnosticCode;
  severity: DiagnosticSeverity;
  message: string;
  /** 1-based. Absent for findings about a whole rule. */
  line?: number;
  column?: number;
};

// Matched by name, not by shape: @font-face{} also parses to an at-rule with no children, but
// that is an ordinary empty-block discard rather than an unsupported statement.
const STATEMENT_AT_RULES: ReadonlySet<string> = new Set([
  IMPORT,
  CHARSET,
  NAMESPACE,
  LAYER,
]);

export type DiagnosticsOptions = {
  source: string;
  /** false when the tree was compiled with rules: ['']. */
  scoped: boolean;
};

export function collectDiagnostics(
  elements: Element[],
  rules: FlatRule[],
  options: DiagnosticsOptions
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const keyframes = new Set<string>();
  let ruleSeen = false;

  const walk = (nodes: Element[], scoped: boolean) => {
    for (const node of nodes) {
      if (isRuleset(node)) {
        ruleSeen = true;
        reportRuleset(node, scoped, diagnostics);
        continue;
      }

      if (!isAtRule(node)) continue;

      if (childrenOf(node).length === 0) {
        if (!STATEMENT_AT_RULES.has(node.type)) continue;

        diagnostics.push({
          code: 'unsupported-at-rule',
          severity: 'error',
          message: `\`${node.value}\` is not supported and was dropped. A constructed stylesheet strips \`@import\` by spec, and happy-dom discards the entire sheet when it sees any body-less at-rule — with one sheet per template that would erase the whole component. Move it to a \`<link>\`.`,
          line: node.line,
          column: node.column,
        });

        if (node.type === IMPORT && ruleSeen) {
          diagnostics.push({
            code: 'import-after-rule',
            severity: 'warning',
            message: `\`${node.value}\` follows a rule. Even where \`@import\` is supported it has to precede every rule in the sheet, so this one could not have applied.`,
            line: node.line,
            column: node.column,
          });
        }
        continue;
      }

      ruleSeen = true;

      if (isConditionalAtRule(node.type)) {
        walk(childrenOf(node), scoped);
        continue;
      }

      // Below a non-conditional at-rule stylis reset the selector context, so nothing there is
      // scoped and neither selector finding applies.
      if (stepsOf(node).length > 0)
        reportKeyframes(node, keyframes, diagnostics);
      walk(childrenOf(node), false);
    }
  };

  walk(elements, options.scoped);

  // Global mode has no selector to give bare declarations.
  if (!options.scoped && elements.some(isDeclaration)) {
    diagnostics.push({
      code: 'rule-without-selector',
      severity: 'warning',
      message:
        'Declarations at the top level of a global block have no selector and were dropped. Wrap them in one.',
    });
  }

  reportScopeInDeclarations(rules, diagnostics);

  const unterminated = findUnterminated(options.source);
  if (unterminated) diagnostics.push(unterminated);

  return diagnostics;
}

function reportRuleset(
  element: RulesetElement,
  scoped: boolean,
  diagnostics: Diagnostic[]
): void {
  if (element.props.every(selector => selector.length === 0)) {
    const declarations = declarationsOf(element);

    if (declarations.length > 0) {
      diagnostics.push({
        code: 'rule-without-selector',
        severity: 'warning',
        message: `A rule with no selector was dropped: \`{${declarations.join(';')}}\`.`,
        line: element.line,
        column: element.column,
      });
    }
  }

  // The two selector findings are silent in global mode, where a leading : is simply correct.
  if (!scoped) return;

  // value is the selector as authored at this nesting level, not the expanded props.
  for (const segment of splitSelectorList(element.value)) {
    const selector = segment.trim();

    if (isShadowBoundary(selector)) {
      diagnostics.push({
        code: 'shadow-boundary',
        severity: 'warning',
        message: `\`${selector}\` crosses a shadow boundary, but a scoped block prepends the component class to it, so it can never match. Use \`css.global\` for this rule.`,
        line: element.line,
        column: element.column,
      });
      continue;
    }

    if (selector.charCodeAt(0) === 58) {
      diagnostics.push({
        code: 'implicit-descendant',
        severity: 'warning',
        message: `\`${selector}\` becomes a descendant of the scope, not a qualifier on it. Prefix it with \`&\` to attach it: \`&${selector}\`.`,
        line: element.line,
        column: element.column,
      });
    }
  }
}

// @keyframes names are global and deliberately unscoped, so a duplicate overwrites rather than
// collides.
function reportKeyframes(
  element: Element,
  seen: Set<string>,
  diagnostics: Diagnostic[]
): void {
  if (seen.has(element.value)) {
    diagnostics.push({
      code: 'duplicate-keyframes',
      severity: 'warning',
      message: `\`${element.value}\` is defined more than once. The name is global and unscoped, so the last definition wins for every template that animates with it.`,
      line: element.line,
      column: element.column,
    });
    return;
  }

  seen.add(element.value);
}

// The sentinel is substituted in selectors only, so one in a declaration value ships verbatim.
function reportScopeInDeclarations(
  rules: FlatRule[],
  diagnostics: Diagnostic[]
): void {
  for (const rule of rules) {
    for (const declaration of rule.declarations) {
      if (!declaration.includes(SCOPE)) continue;

      diagnostics.push({
        code: 'scope-in-declaration',
        severity: 'warning',
        message: `\`${declaration}\` contains \`${SCOPE}\`. The sentinel is only substituted in selectors, so it will reach the browser as written.`,
      });
    }
  }
}

// Top-level commas only: :not(.a, .b) and [data-x='a,b'] are each one segment.
function splitSelectorList(value: string): string[] {
  const segments: string[] = [];
  let depth = 0;
  let quote = 0;
  let start = 0;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);

    if (quote !== 0) {
      if (code === quote && value.charCodeAt(i - 1) !== 92) quote = 0;
    } else if (code === 34 || code === 39) {
      quote = code;
    } else if (code === 40 || code === 91) {
      depth++;
    } else if (code === 41 || code === 93) {
      depth--;
    } else if (code === 44 && depth === 0) {
      segments.push(value.slice(start, i));
      start = i + 1;
    }
  }

  segments.push(value.slice(start));

  return segments;
}

// The element tree cannot show this: an unterminated comment or string swallows the rest of the
// source silently. Only the first finding is returned — everything past it was consumed by it.
function findUnterminated(source: string): Diagnostic | null {
  let line = 1;
  let column = 1;
  let index = 0;

  const step = () => {
    if (source.charCodeAt(index) === 10) {
      line++;
      column = 1;
    } else {
      column++;
    }
    index++;
  };

  while (index < source.length) {
    const code = source.charCodeAt(index);
    const next = source.charCodeAt(index + 1);

    if (code === 47 && next === 42) {
      const openLine = line;
      const openColumn = column;
      step();
      step();
      while (
        index < source.length &&
        !(
          source.charCodeAt(index) === 42 && source.charCodeAt(index + 1) === 47
        )
      ) {
        step();
      }
      if (index >= source.length) {
        return {
          code: 'unterminated-comment',
          severity: 'warning',
          message:
            'Unterminated block comment. The scanner consumed the rest of the source, so every rule after it was lost.',
          line: openLine,
          column: openColumn,
        };
      }
      step();
      step();
      continue;
    }

    if (code === 47 && next === 47) {
      while (index < source.length && source.charCodeAt(index) !== 10) step();
      continue;
    }

    if (code === 34 || code === 39) {
      const openLine = line;
      const openColumn = column;
      step();
      while (index < source.length && source.charCodeAt(index) !== code) {
        // An escape covers the next character, whatever it is.
        if (source.charCodeAt(index) === 92) step();
        step();
      }
      if (index >= source.length) {
        return {
          code: 'unterminated-string',
          severity: 'warning',
          message:
            'Unterminated string. The scanner consumed the rest of the source, so every rule after it was lost.',
          line: openLine,
          column: openColumn,
        };
      }
      step();
      continue;
    }

    step();
  }

  return null;
}
