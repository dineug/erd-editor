const isObject = (json: object, key: string) => {
  const value: unknown = Reflect.get(json, key);
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Whether a diagram file's text is one the tab can read: empty, which starts a
 * new diagram, a v3 document by its doc, or by its settings where a later
 * release leaves the doc out, or the v2 one .vuerd files hold, by its canvas.
 */
export function isReadableDiagram(text: string): boolean {
  if (text.trim() === '') return true;
  try {
    const json: unknown = JSON.parse(text);
    return (
      typeof json === 'object' &&
      json !== null &&
      ('doc' in json ||
        'canvas' in json ||
        (Reflect.get(json, 'version') === '3.0.0' &&
          isObject(json, 'settings')))
    );
  } catch {
    return false;
  }
}
