/**
 * no-comment-markdown
 *
 * Comments are plain prose. Nothing here renders Markdown — editor hover and
 * the emitted .d.ts both show the source text, so emphasis and backticks reach
 * the reader as punctuation that breaks the sentence. Code notation has a
 * place, and that place is @example, which this rule does not read.
 *
 * @example
 * ```ts
 * // wrong: `liftPlan` returns the **plan**.
 * // right: liftPlan returns the plan.
 * ```
 */

/** Emphasis and code notation — dropping the open and close pair keeps the meaning, so this fixes. */
const PAIRED = [
  { messageId: 'bold', pattern: /(\*\*)(?:(?!\*\*)[\s\S])*(\*\*)/g },
  { messageId: 'code', pattern: /(`)[^`]*(`)/g },
];

/** Whole-line structure — how to unfold it is a person's call, so this only reports. */
const STRUCTURAL = [
  { messageId: 'fence', pattern: /^\s*```/ },
  { messageId: 'table', pattern: /^\s*\|.*\|\s*$/ },
  { messageId: 'bullet', pattern: /^\s*-\s+\S/ },
  { messageId: 'ordered', pattern: /^\s*\d+\.\s+\S/ },
];

/** Column where the body starts once the comment markers are off — a block's leading star is not body. */
function bodyStart(line, isFirst, isLine) {
  const prefix = isLine
    ? /^\/\/+ ?/.exec(line)
    : isFirst
      ? /^\/\*+ ?/.exec(line)
      : /^\s*\* ?/.exec(line);
  return prefix ? prefix[0].length : 0;
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    fixable: 'code',
    docs: {
      description:
        'Comment prose carries no Markdown syntax. No tool renders it, so the punctuation is all that arrives.',
    },
    schema: [],
    messages: {
      bold: 'No Markdown emphasis (**...**) in comments — the sentence carries the contrast.',
      code: 'No Markdown code notation (`...`) in comments — an identifier stands on its name.',
      fence: 'No code fence in comments — a code sample belongs in @example.',
      table: 'No Markdown table in comments — align columns with spaces.',
      bullet: 'No Markdown list (-) in comments — separate items by indentation.',
      ordered:
        'No Markdown numbered list in comments — separate items by indentation.',
      terminator:
        'No Markdown notation in comments — here, dropping it would leave a star and a slash adjacent and close the block, so rewrite the sentence by hand instead of taking the fix.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const text = sourceCode.getText();
    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text[i] === '\n') lineStarts.push(i + 1);
    }
    const locAt = offset => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return { line: lo + 1, column: offset - lineStarts[lo] };
    };

    // One unit is a block, or one run of line comments that open their line.
    // Without the run, a pair spanning two lines goes unseen, because each line
    // is its own comment node.
    const unitsOf = comments => {
      const units = [];
      let run = null;
      for (const comment of comments) {
        if (comment.type === 'Block') {
          units.push([comment]);
          run = null;
          continue;
        }
        const before = text.slice(
          lineStarts[comment.loc.start.line - 1],
          comment.range[0]
        );
        const opensLine = before.trim() === '';
        const follows =
          run !== null &&
          comment.loc.start.line === run[run.length - 1].loc.end.line + 1;
        if (opensLine && follows) run.push(comment);
        else {
          const unit = [comment];
          units.push(unit);
          run = opensLine ? unit : null;
        }
      }
      return units;
    };

    return {
      Program() {
        for (const unit of unitsOf(sourceCode.getAllComments())) {
          const isLine = unit[0].type === 'Line';
          const rows = unit.flatMap(comment => {
            const raw = text.slice(comment.range[0], comment.range[1]);
            let at = comment.range[0];
            return raw.split('\n').map((line, index, all) => {
              const row = {
                line,
                at,
                first: index === 0,
                last: index === all.length - 1,
              };
              at += line.length + 1;
              return row;
            });
          });
          let inExample = false;
          let inFence = false;

          // Scan one body made of the prose lines alone.
          let prose = '';
          const origin = [];

          for (const row of rows) {
            const { line } = row;
            const scannable =
              !isLine && row.last ? line.replace(/\*\/\s*$/, '') : line;
            const start = bodyStart(scannable, row.first, isLine);
            const body = scannable.slice(start);
            const base = row.at + start;

            // A tag stands at column zero of the body. An indented @top or
            // @media inside a fence is code, not a tag, and reading it as one
            // releases @example so the sample gets scanned as prose.
            if (/^```/.test(body)) inFence = !inFence;
            else if (!inFence) {
              const tag = /^@(\w+)/.exec(body);
              if (tag) inExample = tag[1] === 'example';
            }
            if (inExample) continue;

            const structural = STRUCTURAL.find(entry =>
              entry.pattern.test(body)
            );
            if (structural) {
              const from = locAt(base);
              context.report({
                loc: {
                  start: from,
                  end: { line: from.line, column: from.column + body.length },
                },
                messageId: structural.messageId,
              });
              continue;
            }

            for (let i = 0; i < body.length; i++) origin.push(base + i);
            origin.push(base + body.length);
            prose += body + '\n';
          }

          for (const { messageId, pattern } of PAIRED) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(prose)) !== null) {
              const open = origin[match.index];
              const close =
                origin[match.index + match[0].length - match[2].length];
              const width = match[1].length;
              // Take the notation off and a star meeting a slash closes the
              // block right there.
              const closes =
                !isLine &&
                [open, close].some(
                  at => text[at - 1] === '*' && text[at + width] === '/'
                );
              context.report({
                loc: { start: locAt(open), end: locAt(close + width) },
                messageId: closes ? 'terminator' : messageId,
                ...(closes
                  ? {}
                  : {
                      fix: fixer => [
                        fixer.removeRange([open, open + width]),
                        fixer.removeRange([close, close + width]),
                      ],
                    }),
              });
            }
          }
        }
      },
    };
  },
};

export default rule;
