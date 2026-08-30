import { alloc, dealloc, Element, parse, RULESET } from 'stylis';

export type CompileOptions = {
  rules?: string[];
};

const DEFAULT_RULES: string[] = [''];

function createScopeRule(rules: string[]): Element {
  return {
    value: '',
    root: null,
    parent: null,
    type: RULESET,
    props: rules.slice(),
    children: [],
    line: 1,
    column: 1,
    length: 0,
    return: '',
    siblings: [],
  } as Element;
}

export function compile(
  source: string,
  options: CompileOptions = {}
): Element[] {
  const rules = options.rules ?? DEFAULT_RULES;
  // stylis' compile() seeds parse() with rules: [''] and rule: null; we call parse()
  // ourselves because the scope belongs in rules, and rule has to be non-null for bare
  // declarations inside a root-level conditional at-rule to get wrapped in a ruleset.
  const rule = options.rules === undefined ? null : createScopeRule(rules);

  // alloc() brackets the parse and stylis keeps the scanner cursor in module-level bindings,
  // so this call must not be re-entered.
  const collected = alloc(source) as Element[];

  // @types/stylis types root/rule as non-nullable, but stylis itself passes null for
  // both at its entry point; the casts are the cost of that hand-written signature.
  const nullElement = null as unknown as Element;

  const elements = dealloc(
    parse(
      '',
      nullElement,
      null,
      rule ?? nullElement,
      rules,
      collected,
      0,
      [0],
      collected as unknown as string[]
    )
  );

  return elements;
}
