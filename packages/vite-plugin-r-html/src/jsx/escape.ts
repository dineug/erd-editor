/**
 * The codegen writes JSX text and attribute values back out inside a template
 * literal, so three characters stop meaning what the author wrote. An
 * un-escaped interpolation opener is a silent injection, not a syntax error.
 */
export const escapeTemplateText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/**
 * Attribute values land inside ="…", so the double quote closes the value a
 * character early. r-html's tokenizer reads the raw attribute text and the DOM
 * decodes the entity, which is why this is &quot; and not \".
 */
export const escapeTemplateAttrValue = (value: string): string =>
  escapeTemplateText(value).replace(/"/g, '&quot;');
