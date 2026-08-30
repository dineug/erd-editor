/**
 * comment-run-limit
 *
 * A run of line comments stops at three — anything longer belongs in AGENTS.md
 * or in the package doc. Only comments that open their line count: a trailing
 * comment takes its context from the code beside it, and a bare // separator
 * does not break a run, it joins one.
 */

/** Upper bound on a run of line comments. The fourth line reports. */
const MAX_RUN = 3;

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'A line comment that opens its line runs three deep at most. A bare // separator counts.',
    },
    schema: [],
    messages: {
      tooLong:
        '{{count}} consecutive line comments — the bound is {{max}} (a bare // separator counts). Move deep design rationale to AGENTS.md.',
    },
  },

  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const lines = sourceCode.getText().split('\n');

    /** Whether the comment opens its line — a trailing comment joins no run. */
    function opensLine(comment) {
      return lines[comment.loc.start.line - 1]?.trimStart().startsWith('//');
    }

    return {
      Program() {
        const owned = sourceCode
          .getAllComments()
          .filter(comment => comment.type === 'Line' && opensLine(comment));
        let run = [];
        const close = () => {
          if (run.length > MAX_RUN) {
            context.report({
              loc: { start: run[0].loc.start, end: run.at(-1).loc.end },
              messageId: 'tooLong',
              data: { count: run.length, max: MAX_RUN },
            });
          }
          run = [];
        };
        for (const comment of owned) {
          const previous = run.at(-1);
          if (previous && comment.loc.start.line !== previous.loc.end.line + 1) {
            close();
          }
          run.push(comment);
        }
        close();
      },
    };
  },
};

export default rule;
