/**
 * The codegen writes JSX text and string attribute values back out *inside* a
 * template literal, so three characters stop meaning what the author wrote.
 *
 * `${` is the one that matters. An un-escaped occurrence turns author text into
 * an interpolation r-html then evaluates — a silent injection, not a syntax
 * error, whenever the surrounding scope happens to hold the named binding.
 */
export const escapeTemplateText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/**
 * Attribute values land inside `="…"`, so the double quote closes the value a
 * character early. r-html's tokenizer reads the raw attribute text and the DOM
 * decodes the entity, which is why this is `&quot;` and not `\"`.
 */
export const escapeTemplateAttrValue = (value: string): string =>
  escapeTemplateText(value).replace(/"/g, '&quot;');
