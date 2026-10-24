/** Every import or export statement with the module it names, type-only ones marked. */
const STATEMENT =
  /^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]|^\s*import\s+['"]([^'"]+)['"]/gm;

/** A require or a dynamic import of a literal module, which loads it at runtime all the same. */
const CALL = /\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** The modules a source names, each marked when only its types are imported. */
export function imports(
  source: string
): Array<{ module: string; typeOnly: boolean }> {
  return [
    ...Array.from(source.matchAll(STATEMENT), match => ({
      module: match[3] ?? match[4],
      typeOnly: Boolean(match[2]),
    })),
    ...Array.from(source.matchAll(CALL), match => ({
      module: match[1],
      typeOnly: false,
    })),
  ];
}
