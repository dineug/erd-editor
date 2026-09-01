import { type Theme, ThemeTokens, toThemeVariableName } from '@/themes/tokens';

/**
 * What one theme token resolved to, looked up by its custom property name. The
 * type names no dom, so the same resolution runs off a computed style here and
 * off a posted record in a realm that has none.
 */
export type ThemeVariableReader = (name: string) => string | null | undefined;

/** One palette as custom property names to values, plain enough to post. */
export type ThemeVariables = Record<string, string>;

/**
 * The palette a scene paints from. A token the reader has no answer for keeps
 * the fallback, which is the same rule the emitted var() carries, so a stage
 * without a stylesheet above it paints the preset rather than nothing.
 */
export function resolveTheme(
  fallback: Theme,
  read: ThemeVariableReader
): Theme {
  const resolved: Theme = { ...fallback };

  for (const token of ThemeTokens) {
    const value = read(toThemeVariableName(token))?.trim();
    value && Reflect.set(resolved, token, value);
  }

  return resolved;
}

/** Reads a palette back out of a record some dom realm captured. */
export const fromThemeVariables =
  (variables: ThemeVariables): ThemeVariableReader =>
  name =>
    variables[name];

/**
 * What the cascade settled each token on, captured off one element. Custom
 * properties inherit and substitute at computed value time, so an override from
 * a rule anywhere above the host arrives here already applied.
 */
export function readThemeVariables(host: Element): ThemeVariables {
  const style = getComputedStyle(host);

  return ThemeTokens.reduce<ThemeVariables>((variables, token) => {
    const name = toThemeVariableName(token);
    const value = style.getPropertyValue(name).trim();
    value && (variables[name] = value);

    return variables;
  }, {});
}

/** The palette the host element resolves to, css overrides included. */
export const resolveHostTheme = (host: Element, fallback: Theme): Theme =>
  resolveTheme(fallback, fromThemeVariables(readThemeVariables(host)));

const OVERRIDE_ATTRIBUTES = ['style', 'class'];

const parentElementOf = (node: Element): Element | null => {
  const parent = node.parentNode;
  if (!parent) return null;

  return parent instanceof ShadowRoot ? parent.host : node.parentElement;
};

/**
 * Calls back when a css override above the host could have moved. It watches
 * the two vectors that leave a dom trace, a stylesheet in head and a class or
 * inline style on the host or an ancestor; a cssom insertRule leaves none.
 */
export function observeThemeOverrides(
  host: Element,
  onChange: () => void
): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};

  const observer = new MutationObserver(onChange);

  for (let node: Element | null = host; node; node = parentElementOf(node)) {
    observer.observe(node, {
      attributes: true,
      attributeFilter: OVERRIDE_ATTRIBUTES,
    });
  }

  const head = host.ownerDocument?.head;
  head &&
    observer.observe(head, {
      childList: true,
      subtree: true,
      characterData: true,
    });

  return () => observer.disconnect();
}
