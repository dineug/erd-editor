/**
 * jsdoc-prose-limit
 *
 * A JSDoc block is one short summary and one @example. Deep design rationale
 * belongs in AGENTS.md, not in the source. Verifiability decides what earns a
 * place here: a claim you can put a witness behind becomes a test, and prose
 * that cannot becomes nothing (git history is canonical). Paragraphs split on
 * blank lines, and a paragraph opening with an @tag is not prose. Splitting one
 * block in two to walk around the bound is what jsdoc-attached catches.
 */

/** Maximum number of prose paragraphs. The second one reports. */
const MAX_PROSE_PARAGRAPHS = 1;

/** Upper bound on prose lines. The fourth one reports. */
const MAX_PROSE_LINES = 3;

/**
 * Splits a JSDoc body into paragraphs — each entry is that paragraph's lines.
 *
 * @example
 * ```js
 * paragraphsOf('* summary\n *\n * @example x'); // [['summary'], ['@example x']]
 * ```
 */
function paragraphsOf(value) {
  const lines = value
    .split('\n')
    .map(line => line.replace(/^\s*\*+/, '').trim());
  const paragraphs = [];
  let current = [];
  for (const line of lines) {
    if (line === '') {
      if (current.length > 0) {
        paragraphs.push(current);
      }
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    paragraphs.push(current);
  }
  return paragraphs;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'JSDoc prose is one paragraph of at most three lines. @example and @tag lines do not count.',
    },
    schema: [],
    messages: {
      tooManyParagraphs:
        '{{count}} prose paragraphs — JSDoc ends at one summary (bound {{max}}). Move a claim you can put a witness behind into a test and delete the rest; git history and AGENTS.md are canonical.',
      tooManyLines:
        '{{count}} lines of prose — the bound is {{max}} (@example and @tag lines do not count). If it needs the length, ask first whether that knowledge can stand as a witness.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();

    return {
      Program() {
        for (const comment of sourceCode.getAllComments()) {
          if (comment.type !== 'Block' || !comment.value.startsWith('*')) {
            continue;
          }
          const prose = paragraphsOf(comment.value).filter(
            paragraph => !paragraph[0].startsWith('@')
          );
          if (prose.length > MAX_PROSE_PARAGRAPHS) {
            context.report({
              loc: comment.loc,
              messageId: 'tooManyParagraphs',
              data: { count: prose.length, max: MAX_PROSE_PARAGRAPHS },
            });
          }
          const proseLines = prose.reduce(
            (sum, paragraph) => sum + paragraph.length,
            0
          );
          if (proseLines > MAX_PROSE_LINES) {
            context.report({
              loc: comment.loc,
              messageId: 'tooManyLines',
              data: { count: proseLines, max: MAX_PROSE_LINES },
            });
          }
        }
      },
    };
  },
};

export default rule;
