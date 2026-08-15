export const SCOPE = 'rhtml-scope';

/**
 * Global and unanchored — `&&` compiles to a doubled sentinel — so run it on selectors only, or a
 * `content:'rhtml-scope'` gets rewritten too.
 */
export function substituteScope(selector: string, scope: string): string {
  return selector.split(SCOPE).join(scope);
}

const SHADOW_BOUNDARY = /^(?::host\b|::slotted\()/;

/** Anchored: matches the leftmost compound only, so `:host .a` hits and `.a :host` does not. */
export function isShadowBoundary(segment: string): boolean {
  return SHADOW_BOUNDARY.test(segment.trim());
}
