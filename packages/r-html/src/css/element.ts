import { DECLARATION, Element, RULESET } from 'stylis';

export type RulesetElement = Element & { props: string[]; children: Element[] };

export type AtRuleElement = RulesetElement;

export type DeclarationElement = Element & { props: string; children: string };

export function isRuleset(element: Element): element is RulesetElement {
  return element.type === RULESET;
}

export function isDeclaration(element: Element): element is DeclarationElement {
  return element.type === DECLARATION;
}

export function isAtRule(element: Element): element is AtRuleElement {
  return element.type.charCodeAt(0) === 64; // '@'
}

export function childrenOf(element: Element): Element[] {
  return Array.isArray(element.children) ? element.children : [];
}

export function declarationText(element: DeclarationElement): string {
  // value minus the trailing ;, never props + ':' + children: for a custom property
  // --x:{a:b}; parses to props: '--x:{a' / children: 'b}'.
  return element.value.charCodeAt(element.value.length - 1) === 59
    ? element.value.slice(0, -1)
    : element.value;
}

export function declarationsOf(element: Element): string[] {
  const declarations: string[] = [];

  for (const child of childrenOf(element)) {
    if (isDeclaration(child)) {
      declarations.push(declarationText(child));
    }
  }

  return declarations;
}

export function stepsOf(element: AtRuleElement): RulesetElement[] {
  return childrenOf(element).filter(isRuleset);
}

/**
 * Whether an at-rule keeps the selector context (and therefore nests) or resets it. Mirrors
 * stylis' own switch (atrule), fallthrough included, since its answer shaped the tree we read.
 */
export function isConditionalAtRule(type: string): boolean {
  const kind = type.charCodeAt(1);

  // d(ocument) m(edia) s(upports)
  if (kind === 100 || kind === 109 || kind === 115) return true;
  // c(ontainer)
  if (kind === 99 && type.charCodeAt(3) === 110) return true;
  // l(ayer), reached for @c… too, per stylis' fallthrough
  if (kind === 99 || kind === 108) return type.charCodeAt(2) === 97;

  return false;
}
