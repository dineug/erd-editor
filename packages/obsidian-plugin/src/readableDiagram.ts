const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

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
      isRecord(json) &&
      ('doc' in json ||
        'canvas' in json ||
        (json.version === '3.0.0' && isRecord(json.settings)))
    );
  } catch {
    return false;
  }
}
